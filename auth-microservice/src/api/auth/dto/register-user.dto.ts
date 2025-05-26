import { ApiProperty } from '@nestjs/swagger';

export class RegisterUserDto {
  @ApiProperty({
    description: 'Username (typically email)',
    example: 'user@example.com',
  })
  username: string;

  @ApiProperty({
    description: 'Temporary password for the user',
    example: 'TempPassword123!',
  })
  temporaryPassword: string;

  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'First name',
    example: 'John',
  })
  firstName: string;

  @ApiProperty({
    description: 'Last name',
    example: 'Doe',
  })
  lastName: string;

  @ApiProperty({
    description: 'Send welcome email to user',
    example: false,
    required: false,
    default: false,
  })
  sendEmail?: boolean;
}
