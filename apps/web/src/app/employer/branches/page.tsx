'use client';

import * as React from 'react';
import {
  MapPin,
  Plus,
  Edit,
  Trash2,
} from 'lucide-react';
import type { CompanyBranchDto } from '@campusjob/contracts';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Dialog } from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';
import {
  fetchEmployerBranches,
  createEmployerBranch,
  updateEmployerBranch,
  deleteEmployerBranch,
} from '@/lib/m03-api';
import { getM03ErrorMessage } from '@/lib/m03-labels';

export default function EmployerBranchesPage() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [branches, setBranches] = React.useState<CompanyBranchDto[]>([]);

  // Create / Edit modal
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingBranch, setEditingBranch] = React.useState<CompanyBranchDto | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  // Form fields
  const [branchName, setBranchName] = React.useState('');
  const [addressLine, setAddressLine] = React.useState('');
  const [city, setCity] = React.useState('');
  const [district, setDistrict] = React.useState('');
  const [latitude, setLatitude] = React.useState<string>('');
  const [longitude, setLongitude] = React.useState<string>('');
  const [isHeadquarter, setIsHeadquarter] = React.useState(false);

  // Delete modal
  const [deleteTarget, setDeleteTarget] = React.useState<CompanyBranchDto | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  const loadBranches = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchEmployerBranches();
      setBranches(res.data || []);
    } catch (err) {
      setError(getM03ErrorMessage(err, 'Không thể tải danh sách chi nhánh.'));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadBranches();
  }, [loadBranches]);

  const openCreateModal = () => {
    setEditingBranch(null);
    setBranchName('');
    setAddressLine('');
    setCity('');
    setDistrict('');
    setLatitude('');
    setLongitude('');
    setIsHeadquarter(false);
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (b: CompanyBranchDto) => {
    setEditingBranch(b);
    setBranchName(b.branchName);
    setAddressLine(b.addressLine);
    setCity(b.city);
    setDistrict(b.district || '');
    setLatitude(b.latitude != null ? String(b.latitude) : '');
    setLongitude(b.longitude != null ? String(b.longitude) : '');
    setIsHeadquarter(b.isHeadquarter);
    setFormError(null);
    setIsModalOpen(true);
  };

  const validateCoordinates = (latStr: string, lngStr: string): { lat?: number; lng?: number; error?: string } => {
    let lat: number | undefined = undefined;
    let lng: number | undefined = undefined;

    if (latStr.trim()) {
      const parsedLat = Number(latStr);
      if (isNaN(parsedLat) || parsedLat < -90 || parsedLat > 90) {
        return { error: 'Vĩ độ (latitude) phải là số từ -90 đến 90.' };
      }
      lat = parsedLat;
    }

    if (lngStr.trim()) {
      const parsedLng = Number(lngStr);
      if (isNaN(parsedLng) || parsedLng < -180 || parsedLng > 180) {
        return { error: 'Kinh độ (longitude) phải là số từ -180 đến 180.' };
      }
      lng = parsedLng;
    }

    return { lat, lng };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchName.trim()) {
      setFormError('Vui lòng nhập tên chi nhánh.');
      return;
    }
    if (!addressLine.trim()) {
      setFormError('Vui lòng nhập địa chỉ cụ thể.');
      return;
    }
    if (!city.trim()) {
      setFormError('Vui lòng nhập tỉnh / thành phố.');
      return;
    }

    const { lat, lng, error: coordError } = validateCoordinates(latitude, longitude);
    if (coordError) {
      setFormError(coordError);
      return;
    }

    try {
      setSubmitting(true);
      setFormError(null);

      if (editingBranch) {
        await updateEmployerBranch(editingBranch.id, {
          branchName: branchName.trim(),
          addressLine: addressLine.trim(),
          city: city.trim(),
          district: district.trim() || undefined,
          latitude: lat,
          longitude: lng,
          isHeadquarter,
        });
        setSuccess(`Cập nhật chi nhánh "${branchName}" thành công.`);
      } else {
        await createEmployerBranch({
          branchName: branchName.trim(),
          addressLine: addressLine.trim(),
          city: city.trim(),
          district: district.trim() || undefined,
          latitude: lat,
          longitude: lng,
          isHeadquarter,
        });
        setSuccess(`Thêm chi nhánh "${branchName}" thành công.`);
      }

      setIsModalOpen(false);
      void loadBranches();
    } catch (err: any) {
      setFormError(getM03ErrorMessage(err, 'Lưu thông tin chi nhánh thất bại.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      setDeleting(true);
      setDeleteError(null);
      await deleteEmployerBranch(deleteTarget.id);
      setSuccess(`Đã xóa chi nhánh "${deleteTarget.branchName}".`);
      setDeleteTarget(null);
      void loadBranches();
    } catch (err: any) {
      setDeleteError(getM03ErrorMessage(err, 'Không thể xóa chi nhánh này.'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quản lý chi nhánh & Địa điểm"
        description="Quản lý mạng lưới văn phòng, cơ sở làm việc để gắn vào tin tuyển dụng và chỉ đường cho ứng viên."
        action={
          <Button variant="primary" onClick={openCreateModal} className="gap-2">
            <Plus className="w-4 h-4" />
            <span>Thêm chi nhánh</span>
          </Button>
        }
      />

      {error && <Alert variant="destructive">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      {loading && (
        <div className="py-16 flex flex-col items-center justify-center gap-3">
          <Spinner className="w-8 h-8 text-primary" />
          <p className="text-sm text-muted-foreground">Đang tải danh sách chi nhánh...</p>
        </div>
      )}

      {!loading && branches.length === 0 && (
        <EmptyState
          title="Chưa có chi nhánh nào"
          description="Doanh nghiệp của bạn chưa tạo chi nhánh nào. Hãy thêm chi nhánh đầu tiên để sinh viên biết chính xác địa điểm làm việc khi ứng tuyển!"
          actionLabel="Thêm chi nhánh ngay"
          onAction={openCreateModal}
        />
      )}

      {!loading && branches.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {branches.map((b) => (
            <Card key={b.id} className="border-border hover:shadow-sm transition-shadow flex flex-col justify-between">
              <CardContent className="p-5 space-y-3 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-base text-foreground line-clamp-1">{b.branchName}</h3>
                    {b.isHeadquarter && (
                      <Badge variant="secondary" className="text-[10px] shrink-0">
                        Trụ sở chính
                      </Badge>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                    {b.addressLine}
                  </p>
                  <p className="text-xs font-medium text-foreground mt-1">
                    {b.district ? `${b.district}, ` : ''}
                    {b.city}
                  </p>

                  {b.latitude != null && b.longitude != null && (
                    <div className="mt-3 p-2 bg-secondary/40 rounded border border-border text-[11px] text-muted-foreground flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span>
                        Tọa độ: {b.latitude.toFixed(6)}, {b.longitude.toFixed(6)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditModal(b)}
                    className="gap-1.5"
                    aria-label={`Sửa ${b.branchName}`}
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>Sửa</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10 gap-1.5"
                    onClick={() => {
                      setDeleteTarget(b);
                      setDeleteError(null);
                    }}
                    aria-label={`Xóa ${b.branchName}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Dialog
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingBranch ? 'Chỉnh sửa chi nhánh' : 'Thêm chi nhánh mới'}
        description="Điền thông tin địa chỉ và tọa độ địa lý chính xác để ứng viên dễ dàng định vị nơi làm việc."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && <Alert variant="destructive">{formError}</Alert>}

          <Input
            label="Tên chi nhánh / Văn phòng (*)"
            placeholder="VD: Trụ sở Hà Nội, Chi nhánh Q1..."
            value={branchName}
            onChange={(e) => setBranchName(e.target.value)}
            required
          />

          <Input
            label="Địa chỉ cụ thể (*)"
            placeholder="VD: Tòa nhà FPT Tower, Số 10 Phạm Văn Bạch"
            value={addressLine}
            onChange={(e) => setAddressLine(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Quận / Huyện"
              placeholder="VD: Cầu Giấy"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
            />
            <Input
              label="Tỉnh / Thành phố (*)"
              placeholder="VD: Hà Nội"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Vĩ độ (Latitude: -90 đến 90)"
              type="number"
              step="any"
              placeholder="VD: 21.028511"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
            />
            <Input
              label="Kinh độ (Longitude: -180 đến 180)"
              type="number"
              step="any"
              placeholder="VD: 105.854444"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="isHeadquarter"
              checked={isHeadquarter}
              onChange={(e) => setIsHeadquarter(e.target.checked)}
              className="rounded border-border text-primary focus:ring-primary h-4 w-4"
            />
            <label htmlFor="isHeadquarter" className="text-xs text-foreground cursor-pointer">
              Đánh dấu là Trụ sở chính của doanh nghiệp
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
            >
              Hủy
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? 'Đang lưu...' : editingBranch ? 'Lưu thay đổi' : 'Tạo chi nhánh'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Xác nhận xóa chi nhánh"
        description={`Bạn có chắc chắn muốn xóa chi nhánh "${deleteTarget?.branchName}" không? Thao tác này không thể hoàn tác.`}
      >
        <div className="space-y-4">
          {deleteError && (
            <Alert variant="destructive" className="text-xs">
              {deleteError}
            </Alert>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
            >
              Hủy
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Đang xóa...' : 'Xóa chi nhánh'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
