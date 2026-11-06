package com.fullstackmall.shop.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * 注册入参：用户名限定字母数字下划线 4~20（数据库 CI 校对，大小写不敏感），
 * 密码明文传输后由服务端 BCrypt 哈希入库。
 */
@Data
public class RegisterRequest {

    @NotBlank(message = "用户名不能为空")
    @Pattern(regexp = "^[a-zA-Z0-9_]{4,20}$", message = "用户名需为 4~20 位字母、数字或下划线")
    private String username;

    @NotBlank(message = "密码不能为空")
    @Size(min = 6, max = 20, message = "密码长度需为 6~20 位")
    private String password;

    @Size(max = 20, message = "昵称最长 20 字")
    private String nickname;
}
