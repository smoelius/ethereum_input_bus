/*====================================================================================================*
 * web.ts
 *====================================================================================================*/

export function as_get<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T
}

/*====================================================================================================*/

export function reload_or_set(id: string, value: string): void {
  as_get<HTMLInputElement>(id).value = sessionStorage.getItem(id) || value
}

/*====================================================================================================*/

export function save(id: string): void {
  sessionStorage.setItem(id, as_get<HTMLInputElement>(id).value)
}

/*====================================================================================================*/

export function show(id: string, visible: boolean): void {
  as_get<HTMLElement>(id).style.visibility = visible ? "visible" : "hidden"
}

/*====================================================================================================*/

export function enable(id: string, enabled: boolean): void {
  const element = as_get<HTMLElement>(id)
  switch (element.tagName) {
    case "INPUT":
      (element as HTMLInputElement).disabled = !enabled
      break
    default:
      element.style.color = enabled ? "initial" : "gray"
      break
  }
}

/*====================================================================================================*/

export function set_text(id: string, value: string): void {
  as_get<HTMLElement>(id).innerHTML = value.split("").map(escape_char).join("")
}

/*====================================================================================================*/

export function escape_char(x: string): string {
  switch (x) {
    case " ": return "&nbsp;"
    case "&": return "&amp;"
    case "<": return "&lt;"
    case ">": return "&gt;"
    default:  return x
  }
}

/*====================================================================================================*/
