export async function copyText(text: string) {
  const reply = await window.jev.copyText(text)
  if (!reply.ok) throw new Error(reply.error)
}
