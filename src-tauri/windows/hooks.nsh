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

  ; === Legacy per-user install cleanup ===
  ; When this per-machine installer runs elevated, $APPDATA/$LOCALAPPDATA resolve
  ; to the admin profile, so we must explicitly scan all user profiles.

  ; 1. Best-effort current-user context (works when not elevated).
  Delete "$APPDATA\Microsoft\Windows\Start Menu\Programs\Beauy Smash Flash.lnk"
  Delete "$APPDATA\Microsoft\Windows\Start Menu\Programs\Beauy Smash Flash\*.*"
  RMDir /r "$APPDATA\Microsoft\Windows\Start Menu\Programs\Beauy Smash Flash"
  RMDir /r "$LOCALAPPDATA\Beauy Smash Flash"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Beauy Smash Flash"

  ; 2. Scan every user profile for lingering per-user installs.
  ;    ProfilesDirectory is usually C:\Users (or localized equivalent).
  ReadRegStr $R0 HKLM "SOFTWARE\Microsoft\Windows NT\CurrentVersion\ProfileList" "ProfilesDirectory"
  ExpandEnvStrings $R0 $R0
  ${If} ${FileExists} "$R0\*.*"
    FindFirst $R1 $R2 "$R0\*"
    loop_profiles:
      StrCmp $R2 "" done_profiles
      StrCmp $R2 "." next_profile
      StrCmp $R2 ".." next_profile
      StrCmp $R2 "Public" next_profile
      StrCmp $R2 "Default" next_profile
      StrCmp $R2 "All Users" next_profile
      StrCmp $R2 "Default User" next_profile

      ; Delete old per-user install directory
      RMDir /r "$R0\$R2\AppData\Local\Beauy Smash Flash"

      ; Delete old per-user Start Menu shortcut
      Delete "$R0\$R2\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Beauy Smash Flash.lnk"
      RMDir /r "$R0\$R2\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Beauy Smash Flash"

      next_profile:
      FindNext $R1 $R2
      Goto loop_profiles
    done_profiles:
    FindClose $R1
  ${EndIf}
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="${BSF_FW_RULE}"'
!macroend
