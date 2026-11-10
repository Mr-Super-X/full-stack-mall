// h5-mall 收货地址 API 层（后端 /mall/addresses，全部需登录）。
//
// 结算页消费：列出地址选默认下单；新建地址为 AddressRequest 契约。

import { request } from '@api/http'

/** 收货地址（与后端 AddressDTO 对齐） */
export interface MallAddress {
  id: number
  receiverName: string
  phone: string
  province: string
  city: string
  district: string
  detail: string
  isDefault: boolean
}

/** 新建/改地址入参（与后端 AddressRequest 对齐；手机号 1 开头 11 位） */
export interface MallAddressPayload {
  receiverName: string
  phone: string
  province: string
  city: string
  district: string
  detail: string
  isDefault?: boolean
}

/**
 * h5-mall 地址 API 命名空间。
 *
 * @group 业务 API：h5-mall 地址
 */
export const h5AddressApi = {
  /** 本人地址列表 */
  list: () => request<MallAddress[]>({ url: '/mall/addresses', method: 'get' }),

  /** 新建地址 */
  create: (data: MallAddressPayload) => request<MallAddress>({ url: '/mall/addresses', method: 'post', data }),
}
