import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({
    description: 'Username',
    example: 'user@example.com',
  })
  username: string;

  @ApiProperty({
    description: 'Current password',
    example: 'CurrentPassword123!',
  })
  currentPassword: string;

  @ApiProperty({
    description: 'New password',
    example: 'NewPassword123!',
  })
  newPassword: string;
}
