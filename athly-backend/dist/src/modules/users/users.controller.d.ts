import { UsersService } from './users.service';
import { UpdateProfileInput } from './dto/update-profile.dto';
import { UserModel } from './models/user.model';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    me(user: UserModel): UserModel;
    updateProfile(user: UserModel, input: UpdateProfileInput): Promise<UserModel>;
}
