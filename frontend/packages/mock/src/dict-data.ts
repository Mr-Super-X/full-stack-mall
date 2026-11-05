/**
 * 字典数据表（单一事实来源）。
 *
 * 消费方：
 * - src/dict.ts（本包）—— dev 动态路由 /mock/dict/:code 按 query.code 查表
 * - src/mockProdServer.ts —— prod（gh-pages）静态展开为逐条 url 注册；
 *   因 vite-plugin-mock client 的 wrapper 不从路径提取参数（query 仅来自 querystring），
 *   prod 无法复用 :code 动态路由，只能静态展开（2026-10-20 用户目检实锤）
 * @trigger 新增字典：只需在本表加键值，dev/prod 双端自动生效
 */
// DictItem 经 @vv/shared 根 barrel 消费（§1.6.2）；原跨包相对路径 '../../shared/src/types/dict'
// 是包化过渡态残留（2026-10-28 审计修正）
import type { DictItem } from '@vv/shared'

/**
 * 字典数据表：key = 字典 code（URL 路径参数）。
 *
 * 约定：
 * - gender / user_status / order_type 为契约演示字典（见 src/modules/demo/examples/Dict.vue）
 * - user_status.locked 带 `disabled: true` —— 契约要求至少一个禁用项，演示 DictSelect 禁选
 * - role 被 store 的 PRELOAD_DICT_KEYS（登录预加载）引用，勿删
 * - order_status 保留兼容存量引用
 */
export const DICT_DATA: Record<string, DictItem[]> = {
  // 性别
  gender: [
    { value: 'male', label: '男' },
    // cssClass 透传演示：该类名在 Dict.vue 演示页有配套样式（粉色系标签）
    { value: 'female', label: '女', cssClass: 'vv-dict-tag--female' },
    { value: 'secret', label: '保密' },
  ],

  // 用户状态（locked 项 disabled —— 锁定态不允许在表单中手动选择，仅展示）
  user_status: [
    { value: 'active', label: '启用', type: 'success' },
    { value: 'inactive', label: '停用', type: 'danger' },
    { value: 'locked', label: '锁定', type: 'info', disabled: true },
  ],

  // 订单类型（每项带 type —— 演示 DictTag 按字典项渲染不同主题色）
  order_type: [
    { value: 'normal', label: '普通订单', type: 'primary' },
    { value: 'prepay', label: '预付订单', type: 'warning' },
    { value: 'refund', label: '退款单', type: 'danger' },
    { value: 'offline', label: '线下订单', type: 'info' },
  ],

  // 角色（登录预加载依赖，勿删）
  role: [
    { value: 'admin', label: '管理员' },
    { value: 'user', label: '普通用户' },
    { value: 'guest', label: '访客' },
  ],

  // 订单状态（存量字典，保留兼容）
  order_status: [
    { value: 'pending', label: '待支付' },
    { value: 'paid', label: '已支付' },
    { value: 'shipped', label: '已发货' },
    { value: 'completed', label: '已完成', type: 'success' },
    { value: 'cancelled', label: '已取消', type: 'info' },
  ],
}
