import { activityRepo, cycleRepo, executionRepo, featureRepo, issueRepo, moduleRepo, projectRepo, testCaseRepo } from '../db';
import type { ExecStatus, Priority } from '../types';

const MODULES: [string, string, string[]][] = [
  ['Đăng ký học', 'DKH', ['Mở đợt đăng ký', 'Đăng ký học phần', 'Hủy đăng ký', 'Kiểm tra tiên quyết', 'Kiểm tra trùng lịch', 'Giới hạn tín chỉ']],
  ['Điểm', 'DIEM', ['Nhập điểm thành phần', 'Tính điểm tổng kết', 'Khóa điểm', 'Công bố điểm']],
  ['Học phí', 'HP', ['Tính công thức học phí', 'Miễn giảm', 'Phiếu thu', 'Công nợ']],
  ['Quản lý sinh viên', 'SV', ['Hồ sơ sinh viên', 'Trạng thái sinh viên', 'Chuyển lớp']],
  ['Cổng sinh viên', 'CSV', ['Đăng nhập', 'Xem lịch học', 'Xem điểm']],
];

const CASE_SEEDS: Record<string, [string, Priority, string[], string, string][]> = {
  DKH: [
    ['Đăng ký học phần khi lớp còn chỗ', 'HIGH', ['POSITIVE'], 'Đợt đăng ký đang mở; lớp học phần còn chỗ.', 'Đăng ký thành công, học phần xuất hiện trong danh sách, sĩ số lớp tăng 1.'],
    ['Không cho đăng ký khi lớp đã đầy', 'HIGH', ['NEGATIVE', 'BOUNDARY'], 'Lớp học phần đã đủ sĩ số tối đa.', 'Hệ thống chặn đăng ký và báo lớp đã đầy.'],
    ['Không cho đăng ký khi vượt giới hạn tín chỉ', 'CRITICAL', ['NEGATIVE', 'BOUNDARY'], 'Sinh viên đã đăng ký 24 tín chỉ, giới hạn 25.', 'Hệ thống chặn đăng ký và báo vượt số tín chỉ tối đa.'],
    ['Chặn đăng ký khi chưa đạt học phần tiên quyết', 'HIGH', ['NEGATIVE'], 'Sinh viên chưa đạt học phần tiên quyết.', 'Hệ thống chặn và hiển thị học phần tiên quyết còn thiếu.'],
    ['Cảnh báo khi đăng ký trùng lịch học', 'HIGH', ['NEGATIVE'], 'Sinh viên đã đăng ký lớp trùng khung giờ.', 'Hệ thống cảnh báo trùng lịch và không cho lưu.'],
    ['Hủy đăng ký trong thời gian cho phép', 'MEDIUM', ['POSITIVE', 'WORKFLOW'], 'Đợt đăng ký còn hiệu lực.', 'Hủy thành công, sĩ số lớp giảm 1, công nợ được tính lại.'],
    ['Khóa đăng ký khi sinh viên còn công nợ', 'CRITICAL', ['CONFIG', 'PERMISSION'], 'Cấu hình DKH_ALLOW_DEBT = false; sinh viên còn nợ học phí.', 'Hệ thống chặn đăng ký và hiển thị số tiền còn nợ.'],
    ['Không cho đăng ký ngoài thời gian đợt', 'MEDIUM', ['BOUNDARY'], 'Đợt đăng ký đã đóng.', 'Hệ thống báo đợt đăng ký đã kết thúc.'],
  ],
  DIEM: [
    ['Nhập điểm thành phần hợp lệ', 'HIGH', ['POSITIVE'], 'Lớp học phần đã có danh sách sinh viên.', 'Điểm được lưu, hiển thị đúng trong bảng điểm.'],
    ['Chặn nhập điểm ngoài thang điểm', 'HIGH', ['BOUNDARY', 'NEGATIVE'], 'Thang điểm 10.', 'Hệ thống báo lỗi khi nhập điểm nhỏ hơn 0 hoặc lớn hơn 10.'],
    ['Tính điểm tổng kết theo trọng số', 'CRITICAL', ['DATA'], 'Trọng số: CC 10%, GK 30%, CK 60%.', 'Điểm tổng kết đúng công thức, làm tròn theo quy định.'],
    ['Không cho sửa điểm sau khi khóa', 'CRITICAL', ['PERMISSION', 'WORKFLOW'], 'Bảng điểm đã khóa.', 'Hệ thống chặn sửa và ghi log người thao tác.'],
    ['Công bố điểm cho sinh viên', 'MEDIUM', ['WORKFLOW'], 'Điểm đã khóa.', 'Sinh viên xem được điểm trên cổng sinh viên.'],
  ],
  HP: [
    ['Tính học phí theo số tín chỉ đăng ký', 'CRITICAL', ['DATA'], 'Sinh viên đăng ký 15 tín chỉ, đơn giá theo hệ đào tạo.', 'Học phí tính đúng số tín chỉ nhân đơn giá.'],
    ['Áp dụng miễn giảm đúng đối tượng', 'HIGH', ['DATA', 'CONFIG'], 'Sinh viên thuộc diện miễn giảm 50%.', 'Học phí giảm đúng 50%, hiển thị lý do miễn giảm.'],
    ['Lập phiếu thu học phí', 'MEDIUM', ['POSITIVE', 'WORKFLOW'], 'Sinh viên có công nợ.', 'Phiếu thu được tạo, công nợ giảm tương ứng.'],
    ['Kiểm tra công nợ sau khi hủy đăng ký', 'HIGH', ['INTEGRATION'], 'Sinh viên hủy 1 học phần 3 tín chỉ.', 'Công nợ giảm đúng số tiền của 3 tín chỉ.'],
  ],
  SV: [
    ['Tạo mới hồ sơ sinh viên', 'MEDIUM', ['POSITIVE'], 'Có đủ thông tin bắt buộc.', 'Hồ sơ được lưu, mã sinh viên sinh tự động.'],
    ['Chặn trùng mã sinh viên', 'HIGH', ['NEGATIVE'], 'Mã sinh viên đã tồn tại.', 'Hệ thống báo trùng và không cho lưu.'],
    ['Cập nhật trạng thái sinh viên thôi học', 'HIGH', ['WORKFLOW'], 'Sinh viên đang học.', 'Trạng thái chuyển sang Thôi học, sinh viên không đăng ký học được.'],
  ],
  CSV: [
    ['Đăng nhập cổng sinh viên đúng tài khoản', 'HIGH', ['POSITIVE'], 'Tài khoản đang hoạt động.', 'Đăng nhập thành công, vào trang chủ cổng sinh viên.'],
    ['Chặn đăng nhập sai mật khẩu 5 lần', 'MEDIUM', ['NEGATIVE', 'PERMISSION'], 'Cấu hình khóa tài khoản sau 5 lần sai.', 'Tài khoản bị khóa tạm thời và hiển thị thông báo.'],
    ['Xem lịch học theo tuần', 'MEDIUM', ['UI'], 'Sinh viên đã đăng ký học phần.', 'Lịch học hiển thị đúng lớp, phòng, khung giờ.'],
    ['Xem điểm sau khi công bố', 'MEDIUM', ['POSITIVE'], 'Điểm đã công bố.', 'Sinh viên xem được điểm thành phần và điểm tổng kết.'],
  ],
};

export async function seedDemo() {
  const project = await projectRepo.create({
    code: 'EPU', name: 'Triển khai ASC University', customer: 'Trường Đại học Điện lực',
    status: 'UAT', version: 'V3.2.15', pm: 'Nguyễn Văn A', consultant: 'Trần Thị B',
    startDate: '2026-06-01', goLiveDate: '2026-09-15',
    description: 'Dữ liệu mẫu để thử nhanh toàn bộ luồng UAT.',
  });

  const moduleIds: Record<string, string> = {};
  const featureIds: Record<string, string> = {};
  let order = 0;
  for (const [name, code, feats] of MODULES) {
    const m = await moduleRepo.create({ projectId: project.id, code, name, order: order++ });
    moduleIds[code] = m.id;
    for (const f of feats) {
      const fr = await featureRepo.create({ projectId: project.id, moduleId: m.id, name: f });
      featureIds[`${code}|${f}`] = fr.id;
    }
  }

  const cases = [];
  for (const [code, seeds] of Object.entries(CASE_SEEDS)) {
    const featList = MODULES.find((m) => m[1] === code)![2];
    let n = 1;
    for (const [title, priority, types, pre, expected] of seeds) {
      cases.push({
        caseCode: `EPU-${code}-TC${String(n).padStart(3, '0')}`,
        projectId: project.id,
        moduleId: moduleIds[code],
        featureId: featureIds[`${code}|${featList[(n - 1) % featList.length]}`],
        title, priority, testTypes: types, preconditions: pre,
        testData: '', expectedResult: expected,
        steps: [
          { order: 1, action: 'Đăng nhập hệ thống bằng tài khoản có quyền phù hợp.' },
          { order: 2, action: `Vào chức năng ${featList[(n - 1) % featList.length]}.` },
          { order: 3, action: 'Thực hiện thao tác theo điều kiện của Test Case.' },
          { order: 4, action: 'Kiểm tra kết quả hiển thị và dữ liệu sau thao tác.' },
        ],
        tags: priority === 'CRITICAL' ? ['SMOKE', 'CRITICAL_FLOW'] : n % 3 === 0 ? ['REGRESSION'] : [],
        owner: 'Trần Thị B',
      });
      n++;
    }
  }
  const created = await testCaseRepo.bulkCreate(cases as any);

  const round1 = await cycleRepo.create({
    projectId: project.id, name: 'UAT Round 1', environment: 'UAT', version: 'V3.2.10',
    startDate: '2026-08-01', endDate: '2026-08-05', status: 'COMPLETED', planCaseIds: [],
    tester: 'Đội triển khai', note: 'Vòng UAT đầu tiên cùng key user.',
  });
  const round2 = await cycleRepo.create({
    projectId: project.id, name: 'UAT Round 2', environment: 'UAT', version: 'V3.2.15',
    startDate: '2026-08-12', endDate: '2026-08-20', status: 'IN PROGRESS', planCaseIds: [],
    tester: 'Đội triển khai',
  });

  const pattern: ExecStatus[] = ['PASS', 'PASS', 'FAIL', 'PASS', 'PASS', 'BLOCKED', 'PASS', 'PASS', 'FAIL', 'PASS'];
  const failedCases: typeof created = [];

  for (let i = 0; i < created.length; i++) {
    const st = pattern[i % pattern.length];
    await executionRepo.save({
      projectId: project.id, uatCycleId: round1.id, testCaseId: created[i].id,
      status: st, tester: 'Tester A',
      actualResult: st === 'PASS' ? 'Kết quả đúng như mong đợi.'
        : st === 'FAIL' ? 'Kết quả không đúng mong đợi, xem Issue liên quan.'
          : 'Chưa có dữ liệu test trên môi trường UAT.',
      evidence: [], executedAt: Date.now() - 9 * 86400000,
    } as any);
    if (st === 'FAIL') failedCases.push(created[i]);
  }

  // Round 2: đã chạy 70% số case
  const round2Count = Math.floor(created.length * 0.7);
  for (let i = 0; i < round2Count; i++) {
    const st: ExecStatus = i % 9 === 4 ? 'FAIL' : i % 13 === 7 ? 'BLOCKED' : 'PASS';
    await executionRepo.save({
      projectId: project.id, uatCycleId: round2.id, testCaseId: created[i].id,
      status: st, tester: 'Tester A',
      actualResult: st === 'PASS' ? 'Kết quả đúng như mong đợi.' : 'Hệ thống chưa xử lý đúng nghiệp vụ.',
      evidence: [], executedAt: Date.now() - (i % 3) * 86400000,
    } as any);
  }

  let bug = 1;
  for (const c of failedCases.slice(0, 6)) {
    const st = bug % 3 === 0 ? 'READY FOR RETEST' : bug % 3 === 1 ? 'OPEN' : 'IN PROGRESS';
    const issue = await issueRepo.create({
      issueCode: `EPU-BUG-${String(bug).padStart(3, '0')}`,
      projectId: project.id, moduleId: c.moduleId, featureId: c.featureId, uatCycleId: round1.id,
      title: `Sai nghiệp vụ: ${c.title}`,
      description: 'Ghi nhận trong quá trình UAT Round 1.',
      severity: bug === 1 ? 'CRITICAL' : bug % 2 === 0 ? 'HIGH' : 'MEDIUM',
      priority: 'HIGH', status: st as any, environment: 'UAT', version: 'V3.2.10',
      stepsToReproduce: c.steps.map((s: any, i: number) => `${i + 1}. ${s.action}`).join('\n'),
      expectedResult: c.expectedResult,
      actualResult: 'Hệ thống không xử lý đúng như mong đợi.',
      reporter: 'Tester A', assignee: 'Dev Team',
      testCaseIds: [c.id], evidence: [], reopenCount: 0,
      fixedAt: st === 'READY FOR RETEST' ? Date.now() - 86400000 : undefined,
    });
    await activityRepo.log({
      projectId: project.id, entityType: 'ISSUE', entityId: issue.id, entityCode: issue.issueCode,
      action: 'Tạo Issue từ Test Case FAIL', detail: c.caseCode, user: 'Tester A',
    });
    bug++;
  }

  await activityRepo.log({
    projectId: project.id, entityType: 'PROJECT', entityId: project.id, entityCode: 'EPU',
    action: 'Khởi tạo dữ liệu mẫu', detail: `${created.length} Test Case, 2 vòng UAT`, user: 'System',
  });

  return project.id;
}
