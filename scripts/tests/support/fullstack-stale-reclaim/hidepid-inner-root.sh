#!/usr/local/bin/bash
# Runs as root, already inside a fresh, PRIVATE mount namespace created by
# hidepid-case.sh's own `unshare --mount` (already proven able to create
# one there, via a separate no-op probe before this script ever runs) —
# mounting a `hidepid=2` `/proc` here only affects THIS namespace, never
# the real host or the image's own other processes. $1 is the
# still-running root-owned PID hidepid-case.sh wants checked from an
# unprivileged viewer's point of view.
#
# Only a failure of THIS MOUNT ITSELF is a recognized, reported skip
# (e.g. Docker's default AppArmor profile denying the mount(2) syscall
# even with CAP_SYS_ADMIN, as on GitHub's Ubuntu runners): printed on
# stdout as HIDEPID_MOUNT_UNAVAILABLE=... and this script exits 0, so
# hidepid-case.sh can recognize it by that exact marker. Any OTHER
# failure past this point — `su` itself, hidepid-inner-nobody.sh failing
# to source the lib, or one of ITS OWN checks — is a real bug and must
# propagate as this script's own non-zero exit status (the last command
# below is `su`, un-guarded, so `set -e` does exactly that), never be
# folded into the same skip path.
set -euo pipefail
root_pid="$1"

mount_err="$(mktemp)"
if mount -t proc -o hidepid=2 proc /proc 2>"${mount_err}"; then
  rm -f "${mount_err}"
else
  echo "HIDEPID_MOUNT_UNAVAILABLE=mount -t proc -o hidepid=2 failed: $(tr '\n' ' ' <"${mount_err}")"
  rm -f "${mount_err}"
  exit 0
fi

su -s /usr/local/bin/bash nobody /support/hidepid-inner-nobody.sh "${root_pid}"
