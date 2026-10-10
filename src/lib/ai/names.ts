// Put real worker names back into the model's Hebrew answer.
//
// The prompt deliberately hides names behind short keys (e0, e1, ...) — fewer
// tokens, and nothing stops the model echoing a name it half-remembers. The
// keys come back in the prose and are swapped for names here.
//
// The trap is prefix collision: a naive replace of "e1" also hits "e10". A
// single regex pass over `e<digits>` avoids it by matching the WHOLE number,
// and an unknown key is left verbatim rather than blanked, so a hallucinated
// id stays visible instead of silently turning into someone real.
export interface EmpResolver {
  empId(key: string): string | undefined
}

export function substituteNames(
  text: string,
  maps: EmpResolver,
  namesById: Record<string, string>,
): string {
  return text.replace(/(^|[^A-Za-z0-9_])e(\d+)\b/g, (whole, prefix: string, digits: string) => {
    const id = maps.empId(`e${digits}`)
    if (!id) return whole
    return `${prefix}${namesById[id] ?? id}`
  })
}
