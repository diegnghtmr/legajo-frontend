#!/usr/bin/env bash
# Shared helper for scripts/npm-in-docker.sh and scripts/e2e-in-docker.sh:
# make sure a named Docker volume exists and is owned by the host user,
# without paying for a recursive `chown -R` on every single run.
#
# Checking only the volume's top-level directory is not enough: an
# interrupted command that ran as root inside the container (e.g. `npm ci`
# retried as root after a permission error) can leave some files
# root-owned even though the volume's own top-level directory entry was
# already chowned by an earlier run — the top-level owner would then say
# "fine" while part of the tree is still wrong. Instead, `find` walks the
# volume looking for the first entry whose owner or group does not match
# the host user, stopping immediately at that entry (`-quit`) rather than
# scanning the rest of a large node_modules tree once a mismatch is known;
# when the whole tree already matches, this is one read-only stat per file
# (no writes), cheaper than the recursive chown it decides whether to run.
#
# Usage: prepare_host_owned_volume <volume-name> <image>

prepare_host_owned_volume() {
  local volume="$1"
  local image="$2"
  local want_uid
  local want_gid
  want_uid="$(id -u)"
  want_gid="$(id -g)"

  docker volume create "${volume}" >/dev/null

  local mismatch
  mismatch="$(docker run --rm -v "${volume}:/vol" "${image}" \
    find /vol \( ! -user "${want_uid}" -o ! -group "${want_gid}" \) -print -quit)"

  if [ -n "${mismatch}" ]; then
    docker run --rm -v "${volume}:/vol" "${image}" chown -R "${want_uid}:${want_gid}" /vol
  fi
}
