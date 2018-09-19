/*====================================================================================================*
 * interfaces.ts
 *====================================================================================================*/

export interface Preconfiguration {
  debug_flag?: boolean
  build_path?: string
  eib_address?: string
  self_address?: string
  payee_address?: null | string
  model_flag?: boolean
  calibration?: number[]
  gas_cap_adjustment?: number
  profit?: number
  disk_cache_path?: null | string
  mem_cache_flag?: boolean
}

export interface Configuration {
  debug_flag: boolean
  build_path: string
  eib_address: string
  self_address: string
  payee_address: null | string
  model_flag: boolean
  calibration: number[]
  gas_cap_adjustment: number
  profit: number
  disk_cache_path: null | string
  mem_cache_flag: boolean
}

/*====================================================================================================*/
