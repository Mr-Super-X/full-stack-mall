/** vite dev server 默认配置 */
export const SERVER_DEFAULTS = {
  port: 5174,
  strictPort: true, // 端口占用时直接报错而非自动切换
  // 显式绑 IPv4 0.0.0.0（非默认 localhost）——LAN 真机调试（手机/其他设备访问
  // 电脑 IP:5174-5179 或 :8080 网关）与容器/CI 等非 loopback 入站可达；
  // node 同域网关（scripts/node-gateway.ts）经 127.0.0.1 反代上游亦依赖此监听面。
  // vite 默认绑 localhost（[::1] IPv6 loopback）仅本机可达，不满足上述场景。
  // 安全：dev-only，且仅同域网关（localhost:8080）消费，不暴露公网。
  host: '0.0.0.0',
} as const
