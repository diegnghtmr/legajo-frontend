#!/usr/local/bin/bash
# Runs as root, already inside a fresh, PRIVATE mount namespace
# (`unshare --mount`, from hidepid-case.sh) — mounting a `hidepid=2`
# `/proc` here only affects THIS namespace, never the real host or the
# image's own other processes. $1 is the still-running root-owned PID
# hidepid-case.sh wants checked from an unprivileged viewer's point of
# view.
set -euo pipefail
mount -t proc -o hidepid=2 proc /proc
su -s /usr/local/bin/bash nobody /support/hidepid-inner-nobody.sh "$1"
