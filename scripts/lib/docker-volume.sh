#!/usr/bin/env bash
# Shared helper for scripts/npm-in-docker.sh and scripts/e2e-in-docker.sh:
# make sure a named Docker volume exists and is owned by the host user,
# without paying for a recursive `chown -R` on every single run. The first
# time a volume is created it is root-owned, so it needs exactly one chown;
# after that its owner never changes on its own, so re-checking (cheap: a
# single `stat`) and skipping the chown when it already matches is enough.
#
# Usage: prepare_host_owned_volume <volume-name> <image>

prepare_host_owned_volume() {
  local volume="$1"
  local image="$2"
  local want_owner
  want_owner="$(id -u):$(id -g)"

  docker volume create "${volume}" >/dev/null

  local current_owner
  current_owner="$(docker run --rm -v "${volume}:/vol" "${image}" stat -c '%u:%g' /vol)"

  if [ "${current_owner}" != "${want_owner}" ]; then
    docker run --rm -v "${volume}:/vol" "${image}" chown -R "${want_owner}" /vol
  fi
}
