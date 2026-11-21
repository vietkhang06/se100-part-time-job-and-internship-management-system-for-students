import { BadRequestException, Controller, Get, Header, Inject, NotFoundException, Param, Post, Query, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@campusjob/contracts';
import { JwtAuthGuard } from '../../../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/guards/roles.guard';
import { Roles } from '../../../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../../../shared/decorators/current-user.decorator';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { FileAssetService, FileAssetStatus } from '../../../../shared/storage/file-asset.service';
import { IStorageService, STORAGE_SERVICE_TOKEN } from '../../../../shared/storage/storage.interface';
import { ResubmitCompanyVerificationUseCase } from '../../application/use-cases/resubmit-company-verification.use-case';

@Controller('verification')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VerificationWorkspaceController {
  constructor(private readonly db: PrismaService, private readonly assets: FileAssetService,
    private readonly resubmit: ResubmitCompanyVerificationUseCase,
    @Inject(STORAGE_SERVICE_TOKEN) private readonly storage: IStorageService) {}

  @Post('documents')
  @Roles(UserRole.EMPLOYER)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
  async upload(@CurrentUser('id') ownerUserId: string, @UploadedFile() file?: {buffer: Buffer; originalname: string}) {
    if (!file || file.buffer.subarray(0, 5).toString() !== '%PDF-') throw new BadRequestException('Hãy chọn giấy tờ dạng PDF.');
    const asset = await this.assets.storeFileAsset({ ownerUserId, mimeType: 'application/pdf',
      buffer: file.buffer, originalFilename: file.originalname, status: FileAssetStatus.PENDING_UPLOAD });
    return this.resubmit.execute(ownerUserId, { documents: [{ fileAssetId: asset.id }] });
  }

  @Get('jobs/:id')
  @Roles(UserRole.MODERATOR, UserRole.ADMIN)
  async reviewJob(@Param('id') id:string) {
    const job = await this.db.jobPosting.findUnique({ where:{id},
      select:{ title:true, description:true, schedule:true, salary:true, benefits:true, deadline:true,
        branch:{select:{branchName:true,city:true}}, company:{select:{name:true,verificationStatus:true}} } });
    if (!job) throw new NotFoundException('Tin không còn tồn tại.');
    return job;
  }

  @Get('pending')
  @Roles(UserRole.ADMIN)
  pending(@Query('page') page = '1') {
    const index = Number(page);
    if (!Number.isSafeInteger(index) || index < 1 || index > 100000) throw new BadRequestException('Trang không hợp lệ.');
    return this.db.company.findMany({ where: { verificationStatus: 'PENDING_REVIEW' }, skip: (index-1)*20, take: 20,
      orderBy: [{ createdAt: 'asc' },{ id: 'asc' }], select: { id: true, name: true, taxId: true,
        verifications: { take: 1, orderBy: { submittedAt: 'desc' }, select: { documents: { select: { id: true } } } } } });
  }

  @Get('documents/:id')
  @Roles(UserRole.ADMIN)
  @Header('Cache-Control','no-store')
  @Header('X-Content-Type-Options','nosniff')
  async download(@Param('id') id: string) {
    const doc = await this.db.companyVerificationDocument.findUnique({ where: { id }, include: { fileAsset: true } });
    if (!doc) throw new NotFoundException();
    return new StreamableFile(await this.storage.read(doc.fileAsset.storageKey), { type: 'application/octet-stream', disposition: 'attachment; filename="document.pdf"' });
  }
}
