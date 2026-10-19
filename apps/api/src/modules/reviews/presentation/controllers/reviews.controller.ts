import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CompanyReviewListDto, PaginatedResponse, ReviewDto, UserRole } from '@campusjob/contracts';
import { JwtAuthGuard } from '../../../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/guards/roles.guard';
import { Roles } from '../../../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../../../shared/decorators/current-user.decorator';
import { CreateReviewDto, ListReviewsQueryDto, ReplyReviewDto } from '../../application/dto/review.dto';
import { CreateReviewUseCase } from '../../application/use-cases/create-review.use-case';
import { ListMyReviewsUseCase } from '../../application/use-cases/list-my-reviews.use-case';
import { ListCompanyReviewsUseCase } from '../../application/use-cases/list-company-reviews.use-case';
import { ListEmployerReviewsUseCase } from '../../application/use-cases/list-employer-reviews.use-case';
import { ReplyToReviewUseCase } from '../../application/use-cases/reply-to-review.use-case';

@ApiTags('Reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(
    private readonly createReview: CreateReviewUseCase,
    private readonly listMyReviews: ListMyReviewsUseCase,
    private readonly listCompanyReviews: ListCompanyReviewsUseCase,
    private readonly listEmployerReviews: ListEmployerReviewsUseCase,
    private readonly replyToReview: ReplyToReviewUseCase,
  ) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'UC46 — Đánh giá doanh nghiệp (sau khi hồ sơ ứng tuyển có kết quả cuối)' })
  @ApiResponse({ status: 409, description: 'REVIEW_NOT_ELIGIBLE | REVIEW_ALREADY_EXISTS' })
  create(@CurrentUser('id') studentId: string, @Body() body: CreateReviewDto): Promise<ReviewDto> {
    return this.createReview.execute(studentId, body);
  }

  @Get('mine')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Các đánh giá tôi đã viết' })
  mine(
    @CurrentUser('id') studentId: string,
    @Query() query: ListReviewsQueryDto,
  ): Promise<PaginatedResponse<ReviewDto>> {
    return this.listMyReviews.execute(studentId, query.page, query.limit);
  }

  @Get('employer')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EMPLOYER)
  @ApiOperation({ summary: 'UC45 — Nhà tuyển dụng xem đánh giá dành cho doanh nghiệp của mình' })
  employer(
    @CurrentUser('id') employerId: string,
    @Query() query: ListReviewsQueryDto,
  ): Promise<CompanyReviewListDto> {
    return this.listEmployerReviews.execute(employerId, query.page, query.limit);
  }

  @Get('company/:companyId')
  @ApiOperation({ summary: 'Đánh giá công khai của một doanh nghiệp (không cần đăng nhập)' })
  company(
    @Param('companyId', new ParseUUIDPipe()) companyId: string,
    @Query() query: ListReviewsQueryDto,
  ): Promise<CompanyReviewListDto> {
    return this.listCompanyReviews.execute(companyId, query.page, query.limit);
  }

  @Post(':id/reply')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EMPLOYER)
  @ApiOperation({ summary: 'UC47 — Phản hồi đánh giá (một lần)' })
  @ApiResponse({ status: 409, description: 'REVIEW_ALREADY_REPLIED' })
  reply(
    @CurrentUser('id') employerId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ReplyReviewDto,
  ): Promise<ReviewDto> {
    return this.replyToReview.execute(employerId, id, body.content);
  }
}
