# Cơ sở dữ liệu CampusJob (PostgreSQL 16)

- Quản lý qua Prisma ORM (`apps/api/prisma/schema.prisma`).
- Migration được kiểm soát phiên bản trong `apps/api/prisma/migrations/`.
- Không sử dụng seed dữ liệu nghiệp vụ giả. Quản trị viên khởi tạo qua CLI `pnpm admin:create`.
