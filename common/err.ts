/*====================================================================================================*
 * err.ts
 *====================================================================================================*/

export const program_invocation_short_name
  = process.argv[1].slice(process.argv[1].lastIndexOf("/") + 1)

/*====================================================================================================*/

export function fail(message: string, ...optional_params: any[]): void {
  errx(1, message, ...optional_params)
}

/*====================================================================================================*/

export function errx(code: number, message: string, ...optional_params: any[]): void {
  warnx(message, ...optional_params)
  process.exit(code)
}

/*====================================================================================================*/

export function warnx(message: string, ...optional_params: any[]): void {
  console.error("%s: " + message, program_invocation_short_name, ...optional_params)
}

/*====================================================================================================*/
