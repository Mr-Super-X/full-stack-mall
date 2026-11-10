package com.fullstackmall.shop.payment.controller;

import com.fullstackmall.shop.common.Result;
import com.fullstackmall.shop.payment.dto.NotifyRequest;
import com.fullstackmall.shop.payment.dto.PayResultDTO;
import com.fullstackmall.shop.payment.service.PaymentService;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.Map;

/**
 * 支付接口：pay/status 需登录；notify 与 fake/checkout 免登录（验签鉴权，模拟网关回调链）。
 */
@RestController
@RequestMapping("/mall/payments")
public class PaymentController {

    private final PaymentService paymentService;

    public PaymentController(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    /** 发起支付：CREATED → PAYING，返回模拟收银台地址 */
    @PostMapping("/{paymentNo}/pay")
    public Result<PayResultDTO> pay(@PathVariable String paymentNo) {
        return Result.success(paymentService.pay(paymentNo));
    }

    /** 异步回调（免登录，验签鉴权；重复回调幂等返回） */
    @PostMapping("/fake/notify")
    public Result<Map<String, Object>> notify(@Valid @RequestBody NotifyRequest req) {
        return Result.success(paymentService.notify(req));
    }

    /** 前端轮询支付状态 */
    @GetMapping("/{paymentNo}")
    public Result<PayResultDTO> status(@PathVariable String paymentNo) {
        return Result.success(paymentService.status(paymentNo));
    }

    /**
     * 模拟收银台（FakeProvider 闭环可视化）：展示金额 + "完成支付"按钮 POST notify。
     * 免登录（浏览器直接打开），签名随 URL 携带——与真实收银台同款"信任链"结构。
     */
    @GetMapping(value = "/fake/checkout", produces = MediaType.TEXT_HTML_VALUE)
    public String checkout(@RequestParam String paymentNo,
                           @RequestParam BigDecimal amount,
                           @RequestParam String sign) {
        // 终审 CRITICAL 修复：用户可控参数（paymentNo/sign 经 URL 传入且路径免登录）
        // 拼进 HTML/JS 前必须 HTML 转义，防存储型 XSS（'?paymentNo=';alert(1);// 即可执行任意脚本）
        String safePaymentNo = org.springframework.web.util.HtmlUtils.htmlEscape(paymentNo);
        String safeSign = org.springframework.web.util.HtmlUtils.htmlEscape(sign);
        return """
                <!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <title>模拟收银台</title></head>
                <body style="font-family:system-ui,sans-serif;max-width:420px;margin:80px auto;text-align:center;color:#3d3833">
                  <h2>模拟收银台（FakeProvider）</h2>
                  <p style="font-size:13px;color:#8a8078">支付单号 %s</p>
                  <p style="font-size:32px;font-weight:600;margin:24px 0">¥%s</p>
                  <button id="ok" style="padding:12px 40px;font-size:16px;border:none;border-radius:24px;background:#b3543f;color:#fff;cursor:pointer">完成支付</button>
                  <p id="tip" style="font-size:13px;color:#8a8078;margin-top:24px">点击后向商户服务器发起异步回调（POST /api/mall/payments/fake/notify）</p>
                  <script>
                    document.getElementById('ok').onclick = async () => {
                      document.getElementById('tip').innerText = '支付中…';
                      try {
                        const resp = await fetch('/api/mall/payments/fake/notify', {
                          method: 'POST', headers: {'Content-Type': 'application/json'},
                          // 金额必须字符串携带：JS Number 会丢 ".00"（947.00 → 947），
                          // 导致后端按 "947" 重算签名与按 "947.00" 签发的不一致（验签失败）；
                          // 字符串形式与真实支付宝回调（total_amount 即字符串）一致
                          body: JSON.stringify({paymentNo: '%s', tradeNo: 'FAKE-' + Date.now(), amount: '%s', success: true, sign: '%s'})
                        });
                        const data = await resp.json();
                        if (data.code === 200) {
                          document.getElementById('tip').innerText = '支付成功，正在返回商城…';
                          // 同源相对路径：收银台经同域网关打开，/h5/h5-mall 在任何部署形态下都正确；
                          // 原硬编码 http://localhost:5177/h5-mall 错在 vite base 为 /h5/（404）且非生产地址
                          setTimeout(() => location.href = '/h5/h5-mall', 800);
                        } else {
                          document.getElementById('tip').innerText = '支付失败：' + data.message;
                        }
                      } catch (e) {
                        document.getElementById('tip').innerText = '网络异常，请重试';
                      }
                    };
                  </script>
                </body></html>
                """.formatted(safePaymentNo, amount, safePaymentNo, amount, safeSign);
    }
}
