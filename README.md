# ASC-UAT v1.0

Web app quản lý **Test Case → UAT Execution → Issue → Retest → Báo cáo** cho các dự án triển khai phần mềm quản trị trường Đại học.

Ứng dụng chạy hoàn toàn ở phía trình duyệt (client-side). Không cần server ứng dụng, không cần database, không cần Node.js trên máy chủ.

---

## 1. Deploy nhanh nhất

Gói này có **hai bản chạy được**, chọn một:

### Cách A — bản một file (chống lỗi nhất)

`dist/asc-uat-standalone.html` — toàn bộ ứng dụng nằm trong đúng một file HTML, không cần file phụ nào.

- Copy đi đâu cũng chạy: web server, ổ mạng, USB, gửi qua email
- Chạy được cả khi mở trực tiếp bằng cách nhấp đúp (`file://`)
- Không phụ thuộc cấu hình MIME type của máy chủ

Đây là cách nên dùng nếu bạn từng gặp màn hình trắng.

### Cách B — bản thư mục

Copy **toàn bộ** nội dung `dist/` (gồm cả thư mục `assets/`) lên web server tĩnh:

| Môi trường | Cách làm |
|---|---|
| IIS / Apache / Nginx | Copy nội dung `dist/` vào web root |
| Vercel / Netlify | Kéo thả thư mục `dist/` vào trang deploy |
| Test thử ngay | `npx serve dist` rồi mở link hiện ra |

Đường dẫn tài nguyên ở dạng tương đối nên đặt trong thư mục con vẫn chạy, ví dụ `https://intranet.company.vn/uat/`.

---

## 1b. Nếu gặp MÀN HÌNH TRẮNG

Từ phiên bản này, app không còn trắng trơn nữa: khi không khởi động được, nó hiển thị luôn nguyên nhân trên màn hình. Các trường hợp thường gặp với bản thư mục (cách B):

| Triệu chứng | Nguyên nhân | Xử lý |
|---|---|---|
| Trắng, Console báo lỗi CORS / module | Mở bằng `file://` | Dùng bản một file, hoặc phục vụ qua HTTP |
| Trắng, Console báo 404 ở `assets/...` | Chưa copy thư mục `assets/` | Copy đủ cả `assets/` |
| Trắng, Console báo "MIME type ... not executable" | Máy chủ chưa khai báo `.js` | Thêm MIME `.js` → `text/javascript` (IIS: Feature MIME Types), hoặc dùng bản một file |
| Hiện bảng "Không mở được kho dữ liệu" | Trình duyệt chặn IndexedDB | Tắt chế độ ẩn danh, cho phép site lưu dữ liệu |

Nhanh nhất trong mọi trường hợp: dùng `asc-uat-standalone.html`.

## 2. Build lại từ source

Yêu cầu Node.js 18 trở lên.

```bash
npm install
npm run build             # bản thư mục -> dist/
npm run build:standalone  # bản một file -> dist/asc-uat-standalone.html
npm run build:all         # tạo cả hai
npm run dev               # môi trường phát triển tại http://localhost:5173
```

---

## 3. Dữ liệu được lưu ở đâu

Toàn bộ dữ liệu nằm trong **IndexedDB của trình duyệt**, trên chính máy đang mở app.

Điều này có ba hệ quả cần nắm rõ:

- Mỗi máy / mỗi trình duyệt có kho dữ liệu **riêng biệt**. Hai người dùng không thấy dữ liệu của nhau.
- **Xoá cache / dữ liệu duyệt web sẽ mất toàn bộ dữ liệu.**
- Chế độ ẩn danh (incognito) sẽ mất dữ liệu khi đóng cửa sổ.

Vì vậy hãy dùng **Thiết lập → Dữ liệu → Tải file backup** định kỳ (cuối mỗi ngày UAT). File backup là một file JSON chứa đầy đủ dự án, Test Case, kết quả từng vòng UAT và Issue. Khôi phục bằng nút **Khôi phục từ backup** ở cùng màn hình.

File backup cũng chính là cách **chuyển dữ liệu sang máy khác** hoặc gộp việc của nhiều tester: mỗi người export, một người tổng hợp.

---

## 4. Luồng sử dụng

1. Tạo dự án (mã dự án dùng làm tiền tố Test Case ID, ví dụ `EPU`)
2. Tạo vòng UAT ở **Thiết lập → Vòng UAT** (Round 1, Round 2, Final…)
3. Tạo Test Case, hoặc **Import Excel** từ file có sẵn
4. Vào **Run UAT**, chạy lần lượt từng Test Case
5. PASS chỉ cần 1 click. FAIL bắt buộc nhập Actual Result, sau đó bấm **Tạo Issue** (form tự điền sẵn steps, expected, actual, evidence)
6. Khi dev báo đã sửa, đổi trạng thái Issue sang **FIXED / READY FOR RETEST**
7. Vào **Retest**, retest đạt thì Issue tự chuyển **CLOSED** và Test Case ghi nhận PASS; không đạt thì Issue **REOPENED**
8. Theo dõi ở **Dashboard**, xuất **Báo cáo** Excel gửi khách hàng

Phím tắt trong Run UAT: `P` = PASS, `F` = FAIL, `B` = BLOCKED, `N` = case tiếp theo. `Ctrl+K` mở tìm nhanh ở mọi màn hình.

### Hai nguyên tắc quan trọng

- **Kết quả tách biệt theo từng vòng UAT.** Round 1 FAIL không bị ghi đè khi Round 2 PASS — lịch sử từng vòng được giữ nguyên để đối chiếu và báo cáo.
- **FIXED không đồng nghĩa PASS.** Test Case chỉ được tính PASS sau khi retest đạt. Đây là điểm hay bị bỏ sót khi quản lý UAT bằng Excel.

---

## 5. Dữ liệu mẫu

Lần đầu mở app, ở màn hình Dự án có nút **Dùng dữ liệu mẫu**: tạo dự án EPU với 24 Test Case thuộc 5 phân hệ, 2 vòng UAT và một số Issue ở các trạng thái khác nhau. Dùng để xem toàn bộ luồng hoạt động trước khi nhập liệu thật. Xoá dự án mẫu bất cứ lúc nào.

---

## 6. Import Excel

App đọc dòng đầu tiên làm tiêu đề cột và tự nhận diện các cột thông dụng (cả tiếng Việt lẫn tiếng Anh):

`Test Case ID` · `Module` · `Feature` · `Title` · `Pre-condition` · `Steps` · `Expected Result` · `Priority` · `Test Data` · `Tags`

Bắt buộc có **Title** và **Module**. Mỗi dòng xuống dòng trong ô Steps sẽ thành một bước riêng. Màn hình import có preview, đếm số dòng hợp lệ/lỗi, và hỏi trước khi tạo Module mới.

---

## 7. Kiến trúc & hướng nâng cấp lên V2

```
src/
  db.ts          Repository Layer — TOÀN BỘ truy cập dữ liệu đi qua đây
  store.tsx      State toàn cục (React Context)
  types.ts       Data model
  lib/           stats.ts (thống kê) · excel.ts (import/export) · seed.ts (dữ liệu mẫu)
  components/    UI dùng chung, Layout, các form lớn
  views/         8 màn hình chính
```

Điểm quan trọng về kiến trúc: **không component nào gọi thẳng IndexedDB**. Tất cả đi qua các repository trong `db.ts` (`projectRepo`, `testCaseRepo`, `executionRepo`, `issueRepo`…).

Khi cần chuyển sang **nhiều người dùng chung một server**, chỉ cần viết lại phần thân các hàm repository thành lời gọi REST API — giữ nguyên chữ ký hàm. Toàn bộ tầng giao diện không phải sửa. Đó là lý do V1 chấp nhận lưu local: đổi được về sau mà không phải viết lại.

Công nghệ: Vite 5 · React 18 · TypeScript · Tailwind CSS 3 · Dexie (IndexedDB) · SheetJS (Excel).

---

## 8. Giới hạn đã biết của V1

- Một máy = một kho dữ liệu; chưa dùng chung thời gian thực giữa nhiều người
- Chưa có phân quyền / đăng nhập
- Evidence (ảnh chụp màn hình) lưu dạng base64 trong IndexedDB, giới hạn 6MB mỗi file — dung lượng lớn nên cân nhắc chỉ đính kèm ảnh thật cần thiết
- Chưa đồng bộ với Jira / Redmine
