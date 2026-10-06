'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { apiClient, ApiClientError } from '@/lib/api-client';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    role: 'STUDENT',
    password: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError('');
    setSuccess('');
    
    if (formData.password.length < 8) {
      setError('Mật khẩu phải có ít nhất 8 kí tự');
      return;
    }

    setLoading(true);

    try {
      const result = await apiClient('/auth/register', {
        method: 'POST',
        body: JSON.stringify(formData),
      });

      console.log('Register success:', result);
      setSuccess('Đăng ký thành công! Vui lòng kiểm tra email để xác thực.');
    } catch (error) {
      if (error instanceof ApiClientError) {
        setError(error.message);
      } else {
        setError('Đã xảy ra lỗi. Vui lòng thử lại.');
      }
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white font-bold">
            CJ
          </div>
          <CardTitle>Đăng ký tài khoản</CardTitle>
          <CardDescription>
            Bắt đầu tìm kiếm cơ hội hoặc tuyển dụng nhân tài sinh viên
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input 
              label="Họ và tên" 
              placeholder="Nguyễn Văn A" 
              required 
              value={formData.fullName} 
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value})}/>
            <Input 
              label="Email" 
              type="email" 
              placeholder="name@domain.com" 
              required 
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value})}
              />
            <Select
              label="Vai trò"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value})}
              options={[
                { label: 'Sinh viên (Ứng viên)', value: 'STUDENT' },
                { label: 'Nhà tuyển dụng (Doanh nghiệp)', value: 'EMPLOYER' },
              ]}
            />
            <Input 
              label="Mật khẩu" 
              type="password" 
              placeholder="Tối thiểu 8 ký tự" 
              required 
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value})}
              />
            {error && (
              <p className="text-sm text-destructive">
                {error}
              </p>
            )}

            {success && (
              <p className="text-sm text-primary">
                {success}
              </p>
            )}
            <Button type="submit" variant="primary" className="w-full" disabled={loading}>
              {loading ? 'Đang đăng ký...' : 'Đăng ký tài khoản'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="justify-center border-t border-border text-xs text-muted-foreground">
          Đã có tài khoản?{' '}
          <Link href="/login" className="ml-1 text-primary font-semibold hover:underline">
            Đăng nhập
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
