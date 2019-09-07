#!/bin/bash

set -euxo pipefail

${DOCKER:-docker} build -t cfn-monitor:${GIT_COMMIT:-latest} .
${DOCKER:-docker} run --net none -t --rm cfn-monitor:${GIT_COMMIT:-latest} $@
