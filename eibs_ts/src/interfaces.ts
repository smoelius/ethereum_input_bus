/*====================================================================================================*
 * interfaces.ts
 *====================================================================================================*/

export interface Configuration {
  debug_flag?: boolean
  build_path?: string
  eib_address?: string
  self_address?: string
  payee_address?: string
  model?: boolean
  calibration?: number[]
  gas_cap_adjustment?: number
  profit?: number
  disk_cache_path?: string
  mem_cache_flag?: boolean
}

/*====================================================================================================*/
