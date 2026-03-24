# PDF Signing Application

Ứng dụng ký tài liệu PDF với luồng ký tuần tự.

## 🚀 Quick Start

```bash
# Clone và di chuyển vào thư mục project
cd pdf-signing-app

# Chạy với Docker Compose
docker-compose up -d

# Truy cập
# - Frontend: http://localhost:3000
# - Backend API: http://localhost:8000
# - API Docs: http://localhost:8000/docs
```

## 👤 Tài Khoản Test

| Email | Mật khẩu | Vai trò |
|-------|----------|---------|
| admin@example.com | password123 | Admin |
| creator@example.com | password123 | Creator |
| signer1@example.com | password123 | Signer |
| signer2@example.com | password123 | Signer |

## 📋 Luồng Hoạt Động

### Giai đoạn 1: Creator tạo Workflow
1. Đăng nhập bằng tài khoản creator
2. Tạo workflow mới
3. Upload file PDF chính + file đính kèm
4. Thêm danh sách người ký theo thứ tự
5. Chọn vị trí chữ ký cho mỗi người:
   - **Ảnh chữ ký** (signature): Vị trí để chèn hình ảnh chữ ký
   - **Ngày ký** (date): Vị trí để chèn text ngày ký (dd/mm/yyyy)
6. Gửi workflow cho người ký đầu tiên

### Giai đoạn 2: Signer ký
1. Signer nhận được thông báo (trong ứng dụng)
2. Xem nội dung tài liệu (file chính + file đính kèm)
3. Xác nhận ký hoặc từ chối + ghi chú lý do
4. Nếu đồng ý → Chuyển cho signer tiếp theo

### Giai đoạn 3: Xuất file
1. Khi tất cả đã ký → Workflow hoàn thành
2. Xuất file PDF với:
   - File đính kèm đã gộp vào PDF chính
   - Tất cả chữ ký đã chèn vào đúng vị trí
   - Ngày ký cho mỗi signer

## 🔧 Công Nghệ

- **Frontend**: ReactJS 18, React Router, React Query, React PDF
- **Backend**: Python FastAPI, SQLAlchemy
- **Database**: PostgreSQL 15
- **PDF Processing**: PyPDF2, ReportLab, Pillow
- **Container**: Docker, Docker Compose

## 📁 Cấu Trúc

```
pdf-signing-app/
├── docker-compose.yml      # Docker configuration
├── backend/
│   ├── app/
│   │   ├── api/           # REST API endpoints
│   │   ├── models/        # Database models
│   │   ├── schemas/       # Pydantic schemas
│   │   └── services/     # Business logic
│   ├── Dockerfile
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── components/    # React components
    │   ├── pages/         # Page components
    │   ├── services/      # API services
    │   └── hooks/        # Custom hooks
    ├── Dockerfile
    └── package.json
```

## 📝 API Endpoints

### Authentication
- `POST /api/auth/register` - Đăng ký
- `POST /api/auth/login` - Đăng nhập
- `GET /api/auth/me` - Thông tin user hiện tại

### Workflows
- `GET /api/workflows` - Danh sách workflow
- `POST /api/workflows` - Tạo workflow mới
- `GET /api/workflows/{id}` - Chi tiết workflow
- `PUT /api/workflows/{id}` - Cập nhật workflow
- `DELETE /api/workflows/{id}` - Xóa workflow
- `POST /api/workflows/{id}/send` - Gửi workflow
- `POST /api/workflows/{id}/sign` - Ký workflow
- `POST /api/workflows/{id}/reject` - Từ chối workflow
- `POST /api/workflows/{id}/export` - Xuất file đã ký

### Documents
- `POST /api/documents/upload` - Upload document
- `GET /api/documents/{id}/download` - Download document

## 🔐 Bảo Mật

- JWT Token Authentication
- Password được hash với bcrypt
- CORS configuration
- Role-based access control

## 📄 License

MIT
