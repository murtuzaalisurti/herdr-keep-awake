# Keeps this PC awake while any local Herdr agent is working.
# Controlled from Herdr: command palette → "Keep awake".
$k = Add-Type -Name P -Namespace W -PassThru -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint f);'
while ($true) {
  $busy = (hc ls --json | ConvertFrom-Json).terminals.status -contains 'working'
  # 0x80000001 = stay awake, 0x80000000 = normal sleep rules
  $k::SetThreadExecutionState($(if ($busy) { 0x80000001u } else { 0x80000000u })) | Out-Null
  Write-Host "$(Get-Date -Format HH:mm:ss) $(if ($busy) { 'awake' } else { 'idle' })"
  Start-Sleep 30
}
