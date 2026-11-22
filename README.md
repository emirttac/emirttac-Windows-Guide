# Windows Customization Guide by emirttac

> **Scope:** A conceptual reference for inspecting, servicing offline, and repackaging official Windows 11 installation media using only Microsoft tools (DISM, the Dism PowerShell module, `reg.exe`, `oscdimg`, and Windows Setup), without third-party tools.
>
> **Target:** Windows 11, version 26H2 (build 26300), and supported earlier versions
> **Last verified:** November 22, 2026
>
> This is not a Microsoft-endorsed guide. It was prepared with reference to Microsoft Learn documentation. Windows is a trademark of Microsoft Corporation.

---

## 1. Scope and Limitations

This document covers:

- Installation media structure and WIM/index architecture
- Offline image servicing (mounting, modifying, saving, or discarding)
- Creating bootable ISOs and choosing between UDF and ISO 9660
- Windows Setup scripts and answer file mechanisms
- Validation, logs, and troubleshooting

Out of scope:

- Bypassing system requirement checks
- Modifying Windows activation mechanisms
- Disabling security features such as Secure Boot, BitLocker, Windows Defender, and memory integrity
- Removing Microsoft Edge and WebView2 Runtime (see 10.4)
- Third-party image editing tools

---

## 2. Reference Media and Verification Status

| Property | Value | Verification source |
|---|---|---|
| File name | `Windows11_Client_x64_tr-tr_26300_9457.iso` | File name |
| Version and build | Windows 11 26H2, 10.0.26300.9457 | `install.wim` metadata, Microsoft release table |
| Release (build) | 2026-09-29, GA channel base build | Microsoft Windows 11 release information |
| Language and architecture | tr-TR, x64 | `install.wim` metadata |
| `sources\install.wim` | 7,795,812,908 bytes (7.26 GiB) | File size |
| `sources\boot.wim` | 613,041,691 bytes (approximately 585 MiB) | File size |
| BIOS boot | `boot\etfsboot.com` | File presence |
| UEFI boot | `efi\microsoft\boot\efisys.bin`, `efisys_noprompt.bin` | File presence |

**Currency note:** This build (26300.9457) is behind the latest cumulative build published for 26H2 (26300.10075, 2026-11-19). Update it after installation through Windows Update or by offline servicing.

**Verification scope:** The observations in this document come from parsing WIM XML metadata, checking file presence and sizes, and reviewing winget package metadata. DISM mount and commit operations and ISO creation were not run because they require administrative privileges. The relevant sections were cross-checked against Microsoft Learn documentation.

---

## 3. Prerequisites and Tools

### 3.1 Working environment

- **Privileges:** An elevated (administrator) command prompt is required for mounting, committing, `reg load`, and ISO creation. In a non-elevated session, DISM refuses to run with `Error: 740` (verified in this environment).
- **Mount directory:** It must be empty and should not be created in a protected folder such as Documents (Microsoft recommendation).
- **Disk space:** The working drive must have several times the WIM file's size available. If an operation is interrupted because space runs out, the WIM file may become corrupted.
- **Path length:** Enable long path support (`LongPathsEnabled`) for deep directory structures.
- **Security software:** Real-time scanning can slow down or interrupt mounting and committing. In an enterprise environment, coordinate exclusions with the security team.
- **Read-only attribute:** Files copied from media may be read-only. Check their attributes before proceeding.

### 3.2 Toolset

| Tool | Source | Purpose |
|---|---|---|
| `dism.exe` | Windows (can be updated with ADK Deployment Tools) | WIM queries, mounting and unmounting, package, feature and driver servicing, export, and splitting |
| Dism PowerShell module | Windows | `Get-AppxProvisionedPackage`, `Remove-AppxProvisionedPackage` |
| `reg.exe` | Windows | Loading and unloading offline registry hives |
| `oscdimg.exe` | Windows ADK, Deployment Tools | Creating bootable ISOs |
| Windows Setup | Media (`setup.exe`, `sources\boot.wim`) | Installation and processing scripts and answer files |
| Hyper-V | Windows Pro and above | Validation in a Generation 2 virtual machine |
| Event Viewer, `wevtutil`, `tracerpt` | Windows | Analyzing `setup.etl` event traces |

**Note:** The winget package `Microsoft.OSCDIMG` (version 2.56, publisher: Microsoft) is available as a portable distribution. In production, matching the oscdimg version to the ADK version in use is recommended.

### 3.3 ADK version policy

| Target version | ADK version | Note |
|---|---|---|
| Windows 11 26H2, 25H2, 24H2 | **10.1.26100.9457 (September 2026)** and the latest ADK servicing patch | The appropriate version family for this media |
| Windows 11 26H1 | 10.1.28000.3481 (October 2026) | For 26H1 media only |

Rules:

- When possible, use the ADK that matches the Windows version being serviced. In mixed environments, prefer the ADK appropriate for the newest operating system. Newer Deployment Tools can also run on older Windows versions.
- Apply the current ADK and servicing patch for the WSIM component in connection with **CVE-2026-25166**.
- Because of a vulnerability in the third-party KitBuilder component, upgrade to ADK 10.1.26100.2454 (December 2024) or later.
- 32-bit Windows PE is not supported for Windows 11.

---

## 4. Installation Media Structure

| Path | Purpose |
|---|---|
| `setup.exe`, `sources\setupplatform.exe`, etc. | Setup launchers |
| `bootmgr`, `bootmgr.efi`, `bootmgfw.efi` | Windows Boot Manager (BIOS and UEFI). These files are signed and must not be modified; otherwise Secure Boot validation will fail. |
| `boot\etfsboot.com` | BIOS El Torito boot sector (platform `0x00`) |
| `efi\microsoft\boot\efisys.bin` | UEFI El Torito boot image (platform `0xEF`) |
| `efi\microsoft\boot\efisys_noprompt.bin` | As its name suggests, the UEFI variant without the "press a key" prompt |
| `efi\microsoft\boot\cdboot.efi`, `cdboot_noprompt.efi` | UEFI boot loaders for CD/DVD |
| `boot\bcd`, `efi\microsoft\boot\bcd`, `boot\boot.sdi` | Boot Configuration Data (BCD) and RAM disk image |
| `sources\boot.wim` | WinPE-based setup environment |
| `sources\install.wim` | Windows image (6 indexes) |
| `sources\sxs\` | Features on Demand sources: .NET Framework 3.5 (NetFx3) and optional Internet Explorer packages |
| `support\logging\`, `sources\etwproviders\` | Scripts for loading setup ETW providers |

---

## 5. Edition Indexes and WIM Architecture

### 5.1 WIM format

- **Single-instance storage:** Identical content is stored only once in the WIM. When a new index is added, only new files are written (`/Append-Image`).
- **Multiple indexes:** A WIM file can contain multiple images. Each index has its own `NAME`, `EDITIONID`, `BUILD`, `ARCH`, and `LANGUAGES` metadata.
- **Compression:** `/Compress` options are `fast` (default), `max`, `none`, and `recovery`. `recovery` is used only with an `.esd` destination file.
- **Export:** `/Export-Image` removes unused resource files accumulated in modified images and rewrites the image.
- **ESD:** On media containing `install.esd`, the image can be converted to WIM using `/Export-Image` for servicing.

### 5.2 Indexes in this media

| Index | NAME | EDITIONID | Build | Uncompressed size (approx.) |
|---|---|---|---|---|
| 1 | Windows 11 Home | Core | 10.0.26300 | 23.7 GiB |
| 2 | Windows 11 Home Single Language | CoreSingleLanguage | 10.0.26300 | 23.7 GiB |
| 3 | Windows 11 Education | Education | 10.0.26300 | 24.7 GiB |
| 4 | Windows 11 Pro | Professional | 10.0.26300 | 24.7 GiB |
| 5 | Windows 11 Pro Education | ProfessionalEducation | 10.0.26300 | 24.7 GiB |
| 6 | Windows 11 Pro for Workstations | ProfessionalWorkstation | 10.0.26300 | 24.7 GiB |

> **Warning:** This mapping applies only to this media (26300.9457, tr-TR, x64). Index numbers are not fixed across releases. Index 1 may be Home on one image and a different edition on another. Always verify the mapping using the output of:
>
> ```
> dism /Get-ImageInfo /ImageFile:<SOURCE>\sources\install.wim
> ```

Edition licensing and activation may vary by selected index. Verify the license terms for each index against the relevant Microsoft documentation.

### 5.3 Edition upgrade behavior

Changes made to a mounted image apply to all target editions in the image and are retained when upgrading to a higher edition (Microsoft documentation).

---

## 6. Offline Image Servicing

### 6.1 Lifecycle

1. **Select:** Verify the index with `dism /Get-ImageInfo`.
2. **Mount:** `/Mount-Image /Index:<n> /MountDir:<empty directory>`. Use `/ReadOnly` for inspection or `/Optimize` to reduce initial mounting time. `/Optimize` can slow the first directory access.
3. **Modify:** Files, packages, features, drivers, the registry, and user defaults.
4. **Verify:** `/Get-MountedImageInfo`, `/Get-Features /Format:Table`, `/Get-ProvisionedAppxPackages`.
5. **Persist:** `/Commit-Image` (the image remains mounted) or `/Unmount-Image /Commit`.
6. **Discard:** `/Unmount-Image /Discard` deletes all changes. Use it only when intentionally reverting.
7. **Optimize (optional):** `/Cleanup-Image /StartComponentCleanup /ResetBase`, followed by `/Export-Image`. `/ResetBase` permanently prevents removal of previous components.
8. **Package:** Place the modified `install.wim` in the ISO or USB root directory.

### 6.2 Servicing areas

| Area | Method | Effect | Note |
|---|---|---|---|
| Provisioned applications | `Get-` and `Remove-AppxProvisionedPackage` (Dism module); `/Get-ProvisionedAppxPackages`, `/Remove-ProvisionedAppxPackage` | New user profiles | Does not affect existing users' applications (see 10) |
| Packages (.cab, .msu) | `/Add-Package`, `/Remove-Package` | System components and updates | Order and dependencies matter. The wrong version can cause incompatibilities. |
| Features | `/Enable-Feature /FeatureName:<name> /All /LimitAccess /Source:<media>\sources\sxs` | Optional Windows features | `/LimitAccess` prevents access to Windows Update and WSUS |
| Drivers | `/Add-Driver /Driver:<path> /Recurse` | Hardware drivers | Driver signatures and architecture compatibility are required |
| Language packs | Separate offline language pack workflow | Display and spelling languages | Must match the target version and architecture |
| Default user profile | `Users\Default\NTUSER.DAT` using `reg load` and `reg unload` | New users | Existing profiles are unaffected |
| Machine registry | Image `Windows\System32\config` hives, using `reg load` | Policies and system settings | Risky. Prefer documented setting paths. |
| Files and assets | Direct copying into the mount directory | Wallpaper, images | Windows Resource Protection (WRP) and updates may restore files |
| Setup scripts | `Windows\Setup\Scripts\` | Post-installation actions | See 8 |

### 6.3 Risk assessment

| Risk | Impact | Mitigation |
|---|---|---|
| Wrong index selected | An unexpected edition is installed | Verify with `/Get-ImageInfo` |
| Incorrect `/Discard` | All changes are lost | Review the command. Copy the image at important stages. |
| Image left mounted | Subsequent operations fail | `/Get-MountedImageInfo`, `/Remount-Image` |
| Insufficient disk space | WIM file may be corrupted | Ensure sufficient free space. Rebuild the image if corrupted. |
| Open registry hive | `reg unload` fails | Close Regedit, then unload the hive |
| Modified boot files | Secure Boot and boot failures | Do not modify boot files |
| Incompatible ADK or DISM | Incorrect servicing | Match versions (see 3.3) |
| License violation | Legal risk | See 13 |

### 6.4 Recovery commands

- `dism /Get-MountedImageInfo`: Lists mounted images and their status.
- `dism /Remount-Image /MountDir:<directory>`: Remounts a mounted image that has become inaccessible.
- `dism /Cleanup-Mountpoints`: Cleans up corrupted mount resources. It does not unmount mounted images or delete images that can be remounted.

---

## 7. Booting and ISO Creation

### 7.1 Boot model

- **BIOS:** El Torito entry, platform ID `0x00`, file `boot\etfsboot.com`.
- **UEFI:** El Torito entry, platform ID `0xEF`, file `efi\microsoft\boot\efisys.bin`.
- **Multi-boot:** Two entries are defined in a single command (`-bootdata:2`). Each entry uses `p` (platform), `e` (disables floppy emulation), and `b` (boot sector file).

### 7.2 oscdimg parameter reference

| Parameter | Description |
|---|---|
| `-m` | Ignores the default image size limit. Cannot be used with `-maxsize`. |
| `-o` | Compares duplicate files using MD5 and encodes each only once. `-oc` compares byte by byte and is slower. |
| `-u1` | Writes both UDF and ISO 9660 (8.3 names). Choose based on target system compatibility; testing both views is recommended. |
| `-u2` | Writes UDF only. Systems that cannot read UDF see only an informational file. |
| `-udfver102` | Specifies UDF version 1.02. |
| `-l<label>` | Volume label. Must not contain spaces. |
| `-h` | Includes hidden files and directories. |
| `-g` | Encodes timestamps in UTC. |

Syntax template (with placeholders):

```
oscdimg -m -o -u2 -udfver102 -bootdata:2#p0,e,b"<SOURCE>\boot\etfsboot.com"#pEF,e,b"<SOURCE>\efi\microsoft\boot\efisys.bin" "<SOURCE>" "<DESTINATION>.iso"
```

### 7.3 File system decision

- `install.wim` (7.26 GiB) exceeds the 4 GiB file limit of classic ISO 9660. Therefore, **UDF is required** for media containing `install.wim` (`-u1` or `-u2`).
- When creating USB media, FAT32's 4 GiB file limit leaves two options:
  - **NTFS:** Format the data partition as NTFS. UEFI boot requires a FAT32 boot partition (a dual-partition layout).
  - **Splitting:** Use `dism /Split-Image` to split `install.wim` into `.swm` parts. Select a part size below the FAT32 limit (e.g., 4000 MB). Setup can run from split media using `setup.exe /InstallFrom:install.swm`.

### 7.4 ISO validation

- Record the SHA-256 hash of the generated ISO: `Get-FileHash -Algorithm SHA256 <ISO>`.
- Test BIOS and UEFI boot separately in a virtual machine.
- Archive the `dism /Get-ImageInfo` output for the media's `install.wim`.

---

## 8. Automation During and After Setup

### 8.1 Answer file (unattend.xml)

- Windows Setup processes configuration passes in sequence. The main passes are `windowsPE`, `offlineServicing`, `generalize`, `specialize`, `auditSystem`, `auditUser`, and `oobeSystem`.
- The `offlineServicing` pass can be applied to an offline image using DISM: `dism /Image:<directory> /Apply-Unattend:<file>`. This safely manages the correct order for package operations with dependencies.
- Commands to run after sign-in are defined using `FirstLogonCommands`. These commands are triggered on the next boot. To prevent them from triggering in audit mode, use `Microsoft-Windows-Deployment\Reseal\Mode = Audit`.
- Microsoft warns that long-running scripts can delay the user reaching the desktop. Keep scripts short.

### 8.2 SetupComplete.cmd

- **Location:** `%WINDIR%\Setup\Scripts\SetupComplete.cmd`
- **Privileges:** Local System (LocalSystem)
- **Timing:** Microsoft documentation describes two different timings. The "Order of operations" section says it runs after setup and before the sign-in screen; the introduction says it runs immediately after the desktop is displayed. Write the script so that it produces the correct result in either case (idempotently).
- **Exit code:** Setup does not check the script's exit code.
- **Restart:** Do not use restart commands such as `shutdown -r` inside the script. Setup state becomes corrupted and the script cannot resume.
- **Domain:** On domain-joined machines, domain Group Policy is not applied until the script completes.
- **Product key type:** According to the documentation, this feature may be disabled for installations using OEM product keys, except on Enterprise and Server editions.
- **Log:** `C:\Windows\Panther\UnattendGC\setupact.log`

### 8.3 ErrorHandler.cmd

- **Location:** `%WINDIR%\Setup\Scripts\ErrorHandler.cmd`
- Runs when setup stops because of a fatal error. It executes synchronously with Local System privileges and may be called more than once. Therefore, it should be idempotent.
- It can also be supplied from outside the media using `Setup /m:<folder>`.

### 8.4 Edition-specific behavior

- **Windows 11 Home:** Requires an internet connection and a Microsoft account during initial setup (official requirements documentation). Account for this when planning setup automation.
- **OOBE and account policies:** These may vary by edition. Methods for bypassing OOBE behavior are outside the scope of this document.

---

## 9. User Defaults and the Registry

### 9.1 Default user profile

- **Location:** `C:\Users\Default\NTUSER.DAT`. In an offline image: `<mount directory>\Users\Default\NTUSER.DAT`.
- **Status:** The default user hive is not loaded in the registry by default. To edit it, load it with `reg load` and unload it with `reg unload` when finished.
- **Scope:** Affects only newly created user profiles.
- **Microsoft's method:** The documented approach is to prepare the profile on a reference machine and copy it to the default profile using `CopyProfile`.
- **Default applications:** Windows can load default app associations from `oemdefaultassociations.xml` when the user signs in for the first time (Microsoft documentation).

### 9.2 Reference registry keys

This table is for reference. Verify each value on the target version in a virtual machine.

| Setting | Key | Value and meaning |
|---|---|---|
| Desktop icon: This PC | `HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\HideDesktopIcons\NewStartPanel` → `{20D04FE0-3AEA-1069-A2D8-08002B30309D}` | `0` = visible |
| Desktop icon: Recycle Bin | Same key → `{645FF040-5081-101B-9F08-00AA002F954E}` | `0` = visible |
| Dark mode: apps | `HKCU\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize` → `AppsUseLightTheme` | `0` = dark |
| Dark mode: system | `HKCU\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize` → `SystemUsesLightTheme` | `0` = dark |
| Taskbar: Widgets | `HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced` → `TaskbarDa` | `0` = hidden |
| Taskbar: Chat | `HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced` → `TaskbarMn` | `0` = hidden |
| Wallpaper | `HKCU\Control Panel\Desktop` → `Wallpaper`, `WallpaperStyle`, `TileWallpaper` | Style: `0` center, `2` stretch, `6` fit, `10` fill, `22` span |
| Widgets policy | `HKLM\SOFTWARE\Policies\Microsoft\Dsh` → `AllowNewsAndInterests` | `0` = off |

Policy keys and default behavior can vary between versions. Use Microsoft's Policy CSP and ADMX documentation as references.

### 9.3 Loading and unloading rules

- Load: `reg load HKLM\<temporary-name> "<mount directory>\Users\Default\NTUSER.DAT"`
- Unload: `reg unload HKLM\<temporary-name>`
- Unloading fails if the hive is still open. Close Registry Editor windows first.
- The temporary name must be unique and must not conflict with an existing hive.

---

## 10. Provisioned Applications

### 10.1 Concept

- Provisioned applications are AppX/MSIX packages added to a Windows image. When new user accounts are created, these packages are automatically installed for the user.
- Removing a provisioned package affects only new users. It does not remove packages from existing users. Use `Remove-AppxPackage` for per-user removal.

### 10.2 Command model

```powershell
# List provisioned packages in the offline image
Get-AppxProvisionedPackage -Path <MOUNT_DIRECTORY> | Select-Object DisplayName, PackageName

# Remove by full package name
Remove-AppxProvisionedPackage -Path <MOUNT_DIRECTORY> -PackageName <FULL_PACKAGE_NAME>
```

Additional parameters: `-LogPath` (default `%WINDIR%\Logs\Dism\dism.log`) and `-ScratchDirectory` (must be a local directory).

### 10.3 Operational principles

- List packages before removing them and assess each package's system dependencies.
- Wildcard matches (`*Name*`) may include unexpected packages. Use the full `PackageName` value.
- Package names can vary by version and language. Retrieve values again for each target image.
- Removing packages that are system components (the shell, Store infrastructure, etc.) may cause unexpected behavior. Test every change in a virtual machine.

### 10.4 Microsoft Edge and WebView2 Runtime

- Microsoft describes Microsoft Edge as a core component of Windows and states that it cannot be removed.
- WebView2 Runtime is used by many applications, including Teams and Office.
- Deleting Edge or WebView2 files or services during setup can cause instability and application errors after installation. Therefore, this document does not include a method for removing Edge or WebView2.

---

## 11. Validation

### 11.1 Test environment (Hyper-V)

- **Edition:** Windows Pro or above (client Hyper-V).
- **Virtual machine:** Generation 2. Secure Boot is enabled by default on Generation 2 virtual machines.
- **vTPM:** Windows 11 requires TPM 2.0. Adding a vTPM to a Generation 2 virtual machine allows BitLocker and TPM-based features to be tested.
- **Hardware reference (official Microsoft requirements):** 64-bit, 1 GHz+ processor with at least 2 cores; 4 GB+ RAM; 64 GB+ storage; DirectX 12 and a WDDM 2.0 driver; UEFI firmware with Secure Boot support; TPM 2.0; 720p (9") display.

### 11.2 Checklist

- [ ] ISO SHA-256 hash recorded
- [ ] `install.wim` indexes verified with `dism /Get-ImageInfo`
- [ ] BIOS and UEFI boot tested separately
- [ ] Installed edition matches the index: `DISM /Online /Get-CurrentEdition`
- [ ] Script actions recorded in `C:\Windows\Panther\UnattendGC\setupact.log`
- [ ] Default profile settings checked with a new local user
- [ ] Provisioned package status verified with `Get-AppxPackage -AllUsers`
- [ ] Secure Boot status: `Confirm-SecureBootUEFI`
- [ ] Device encryption status: `manage-bde -status`
- [ ] Windows Update status and build number checked

---

## 12. Release Lifecycle and Updates

### 12.1 Windows 11 release status

Source: Microsoft Learn, Windows 11 release information (updated 2026-11-19).

| Version (build) | Release (GA) | End of support for Home, Pro, Pro Education, Pro for Workstations | End of support for Enterprise, Education | Current build |
|---|---|---|---|---|
| 26H2 (26300) | 2026-09-29 | 2028-10-10 | 2029-10-09 | 26300.10075 |
| 26H1 (28000) | 2026-02-10 | 2028-03-14 | 2029-03-13 | 28000.3620 |
| 25H2 (26200) | 2025-09-30 | 2027-10-12 | 2028-10-10 | 26200.10075 |
| 24H2 (26100) | 2024-10-01 | Support ended | 2027-10-12 | 26100.9974 |
| 23H2 (22631) | 2023-10-31 | Support ended | Support ended | 22631.7714 |

Additional notes:

- Feature updates receive 24 months of support for Home, Pro, Pro for Workstations, and Pro Education, and 36 months for Enterprise and Education.
- 26H1 is only for new devices released in 2026. It is not offered as an in-place upgrade on 24H2 or 25H2 devices. IoT Enterprise is not supported on this release.
- Support for Enterprise LTSC 2024 (based on 24H2) ends on 2029-10-09. Extended support for IoT Enterprise LTSC 2024 ends on 2034-10-10.

### 12.2 26H2 deployment model

26H2 shares the same servicing branch as 24H2 and 25H2. The transition on 24H2 and 25H2 devices uses an enablement package (eKB). ISO media is used for clean installation and reimaging (Windows Insider Blog, Release Preview announcement).

### 12.3 Offline updates

- Add update packages with `/Add-Package`. The package version, architecture, and target image version must match.
- After servicing, the component store can be cleaned using `/Cleanup-Image /StartComponentCleanup`. Adding `/ResetBase` permanently prevents rollback to earlier component versions.
- Compare the post-update build number with the current build on the release information page.

---

## 13. Security, Licensing, and Distribution Boundaries

- **Source:** Use media obtained only from official Microsoft sources. Compare the SHA-256 hash with the official release.
- **License:** Windows is subject to the Microsoft Software License Terms. Reproduction, distribution, and activation of modified media may be restricted by those terms. Legal assessment is required.
- **This repository:** The repository containing this document must not include Windows ISO content (`install.wim`, `sources\`, `boot\`, `efi\`, etc.). GitHub enforces a 100 MiB per-file limit. Republishing Microsoft binaries may violate licensing terms.
- **Security features:** Do not disable Secure Boot, device encryption or BitLocker, Windows Defender, or memory integrity.
- **Security updates:** Keep the ADK and servicing patches current (see 3.3).
- **Enterprise alternative:** For managed devices, prefer management solutions such as Windows Autopilot and Microsoft Intune over image editing.

---

## 14. Logs and Troubleshooting

### 14.1 Log locations

| Location | Contents |
|---|---|
| `X:\Windows\Panther\` | Setup logs before disk access (WinPE) |
| `%WINDIR%\Panther\` | Setup actions after disk configuration, `setuperr.log` |
| `%WINDIR%\Panther\UnattendGC\setupact.log` | SetupComplete and answer file actions |
| `%WINDIR%\Panther\setup.etl` | Setup performance events (using Event Viewer or `wevtutil qe /lf`) |
| `%WINDIR%\Logs\Dism\dism.log` | Default DISM log |
| `%WINDIR%\Inf\setupapi*.log` | PnP driver installation logs |
| `%WINDIR%\Minidump.dmp`, `%WINDIR%\Memory.dmp` | Kernel crash dumps |

### 14.2 Troubleshooting matrix

| Symptom | Possible cause | First check |
|---|---|---|
| `Error: 740` | No elevated privileges | Administrator command prompt |
| Mount fails | Target directory is not empty or is in a protected folder | An empty, unprotected directory |
| Unmount fails | Open file or File Explorer window in the directory | Close windows and run `/Get-MountedImageInfo` |
| Mounted image inaccessible | Unexpected interruption | `/Remount-Image` |
| File size error during ISO creation | ISO 9660 4 GiB limit | Use UDF (`-u1` or `-u2`) |
| Cannot copy `install.wim` to USB | FAT32 4 GiB limit | NTFS layout or `/Split-Image` |
| SetupComplete did not run | File named `.cmd.txt`, wrong location, or OEM key restriction | File extension and `setupact.log` |
| Default profile settings do not appear | Existing user profile (only new profiles are affected) | Test with a new local user |
| Provisioned application still appears | Existing per-user installation or different package name | `Get-AppxPackage -AllUsers` |
| Wallpaper did not change | Version-specific file path | Actual file names under `Windows\Web` in the media |
| Boot fails | Incorrect platform entry, Secure Boot, or UDF incompatibility | `-bootdata` platform codes and Secure Boot status in the virtual machine |

**Wallpaper note:** Third-party sources document that the default Windows 11 Bloom wallpapers are under `Windows\Web\4K\Wallpaper\Windows`. The `Wallpaper\Windows\img0.jpg` path in instructional materials may date from Windows 10. Verify file names on the target media.

---

## 15. Glossary

| Term | Description |
|---|---|
| ADK | Windows Assessment and Deployment Kit. Includes deployment tools such as DISM and oscdimg. |
| Commit / Discard | Save or discard changes to a mounted image |
| eKB | Enablement package. A package that enables features in an existing servicing branch. |
| El Torito | CD/DVD boot standard |
| Features on Demand (FoD) | Optional Windows features and capabilities |
| Hive | Registry file (e.g., `NTUSER.DAT`) |
| Index | Image number within a WIM |
| ISO 9660 / UDF / Joliet | Optical media file systems |
| LCU | Latest Cumulative Update. The most recent cumulative update. |
| Mount / Unmount | Mount WIM contents in a directory or unmount them |
| OOBE | Out-of-Box Experience. The initial setup experience. |
| Provisioned package | AppX/MSIX package added to an image for new users |
| `sources\sxs` | Side-by-side component store |
| TPM 2.0 / vTPM | Hardware or virtual Trusted Platform Module |
| UEFI / Secure Boot | Firmware standard and signed boot verification |
| WIM / ESD / SWM | Windows image formats: compressed images and split WIM |
| WinPE | Windows Preinstallation Environment |
| WRP | Windows Resource Protection. Protected system files. |

---

## 16. References

- Windows 11 download: https://www.microsoft.com/software-download/windows11
- Windows 11 release information: https://learn.microsoft.com/en-us/windows/release-health/windows11-release-information
- Windows 11 requirements: https://learn.microsoft.com/en-us/windows/whats-new/windows-11-requirements
- Windows 11 26H2 Release Preview announcement: https://blogs.windows.com/windows-insider/2026/08/27/releasing-windows-11-version-26h2-to-the-release-preview-channel/
- Install the Windows ADK: https://learn.microsoft.com/en-us/windows-hardware/get-started/adk-install
- DISM image management commands: https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/dism-image-management-command-line-options-s14
- Mount and modify an image: https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/mount-and-modify-a-windows-image-using-dism
- Add or remove packages offline: https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/add-or-remove-packages-offline-using-dism
- .NET Framework 3.5 (offline installation with DISM): https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/deploy-net-framework-35-by-using-deployment-image-servicing-and-management--dism?view=windows-11
- Oscdimg command-line options: https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/oscdimg-command-line-options
- Add custom scripts to Windows Setup (SetupComplete, ErrorHandler): https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/add-a-custom-script-to-windows-setup
- Windows Setup log files: https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/windows-setup-log-files-and-event-logs
- Split a WIM file: https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/split-a-windows-image--wim--file-to-span-across-multiple-dvds?view=windows-11
- Default user profile (CopyProfile): https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/customize-the-default-user-profile-by-using-copyprofile?view=windows-11
- Remove-AppxProvisionedPackage: https://learn.microsoft.com/en-us/powershell/module/dism/remove-appxprovisionedpackage
- Hyper-V Generation 2 security features: https://learn.microsoft.com/en-us/windows-server/virtualization/hyper-v/generation-2-virtual-machine-security-features

---

*Document version: 2.0 · Last reviewed: November 22, 2026*
