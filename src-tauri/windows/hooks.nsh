; Beauy Smash Flash — NSIS installer hooks.
;
; LAN play needs inbound UDP on the discovery port (5554) and game port (5555).
; Windows Firewall blocks inbound UDP on Public networks (e.g. school Wi-Fi) by
; default, which silently breaks hosting — the host never receives Join packets
; and clients see "Did not receive ID from host". We add an all-profile inbound
; allow rule at install time (the per-machine installer runs elevated, so netsh
; has the rights it needs) and remove it on uninstall.
;
; The rule is port-based so it survives rebuilds, path changes, and the exe name.

!define BSF_FW_RULE "Beauy Smash Flash LAN"

!macro NSIS_HOOK_POSTINSTALL
  ; Idempotent: drop any previous rule of the same name before re-adding.
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="${BSF_FW_RULE}"'
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="${BSF_FW_RULE}" dir=in action=allow protocol=UDP localport=5554-5555 profile=any'
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="${BSF_FW_RULE}"'
!macroend
