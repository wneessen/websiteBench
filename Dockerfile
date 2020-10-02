## Dockerfile for xssScanService
## 
FROM        archlinux
LABEL       maintainer="wn@neessen.net"
RUN         pacman -Syu --noconfirm --noprogressbar
RUN         pacman -S --noconfirm --noprogressbar npm nodejs chromium
RUN         /usr/bin/groupadd -r websitebench && /usr/bin/useradd -r -g websitebench -c "websiteBench user" -m -s /bin/bash -d /opt/websiteBench websitebench
COPY        . /opt/websiteBench
RUN         chown -R websitebench:websitebench /opt/websiteBench
WORKDIR     /opt/websiteBench
USER        websitebench
RUN         npm install
VOLUME      [ "/opt/websiteBench/conf" ]
ENTRYPOINT  ["/usr/bin/node", "dist/websiteBench.js", "--log-resource-errors", "--browserpath", "/usr/bin/chromium", "--no-sandbox"]
