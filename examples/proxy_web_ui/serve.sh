#!/bin/bash

cd html

python -m SimpleHTTPServer $* &

trap "kill $! ; wait $!" EXIT

wait
