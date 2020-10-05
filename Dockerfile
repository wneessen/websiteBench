## Dockerfile for xssScanService
## 
FROM        archlinux
LABEL       maintainer="wn@neessen.net"
RUN         pacman -Syu --noconfirm --noprogressbar
RUN         pacman -S --noconfirm --noprogressbar npm nodejs chromium
RUN         /usr/bin/groupadd -r websitebench && /usr/bin/useradd -r -g websitebench -c "websiteBench user" -m -s /bin/bash -d /opt/websiteBench websitebench
COPY        ["LICENSE", "README.md", "package.json", "package-lock.json", "/opt/websiteBench/"]
COPY        ["dist", "/opt/websiteBench/dist"]
COPY        ["log", "/opt/websiteBench/log"]
COPY        ["config", "/opt/websiteBench/config"]
RUN         chown -R websitebench:websitebench /opt/websiteBench
WORKDIR     /opt/websiteBench
USER        websitebench
RUN         npm install
VOLUME      ["/opt/websiteBench/config", "/opt/websiteBench/log"]
ENTRYPOINT  ["/usr/bin/node", "dist/websiteBench.js"]
