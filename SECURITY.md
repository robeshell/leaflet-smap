# 安全策略 / Security Policy

## 支持的版本 / Supported versions

只有两个包各自的最新版本会收到安全修复。
Only the latest release of each package receives security fixes.

## 报告漏洞 / Reporting a vulnerability

**请不要为安全问题开公开的 issue。**
**Please do not open a public issue for security problems.**

在本仓库的 [Security 页面](https://github.com/robeshell/leaflet-smap/security/advisories/new)点「Report a vulnerability」私下提交。请写明受影响的包和版本、复现步骤，以及你判断的影响。

Report privately through [Report a vulnerability](https://github.com/robeshell/leaflet-smap/security/advisories/new) on this repository's Security tab. Include the affected package and version, steps to reproduce, and the impact as you understand it.

这是业余时间维护的项目，我们会尽快回复，但不承诺具体时限。
This project is maintained in spare time. We will respond as soon as we can, without a guaranteed timeline.

## 范围 / Scope

本库不提供也不代理地图数据，各家瓦片服务和天地图接口自身的问题请向对应的服务方报告。在自己项目里泄露的天地图密钥或 Mapbox 令牌，请直接到对应的控制台作废。

This library does not provide or proxy map data. Problems in third-party tile services or the TianDiTu API should go to those providers. If a TianDiTu key or Mapbox token leaked from your own project, revoke it in the provider's console.
