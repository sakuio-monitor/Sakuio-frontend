import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PageListHeader } from "../components/PageListHeader";
import { Tabs } from "../components/Tabs/Tabs";
import "../styles/about.css";

type LicenseGroup = { license: string; packages: string[] };
type LicenseSection = { kind: "rust" | "npm"; titleKey: string; descriptionKey?: string; groups: LicenseGroup[] };

const LICENSE_SECTIONS: LicenseSection[] = [
  {
    kind: "rust",
    titleKey: "admin.about.sections.rust",
    descriptionKey: "admin.about.sections.rustDesc",
    groups: [
      {
        license: "MIT / Apache-2.0",
        packages: [
          "axum", "tokio", "sqlx", "serde", "serde_json", "reqwest",
          "tower", "tower-http", "tracing", "tracing-subscriber",
          "sea-query", "uuid", "chrono", "thiserror", "anyhow",
          "futures-util", "bytes", "rand", "hex", "sha2", "zip",
          "url", "mime_guess",
        ],
      },
      { license: "Apache-2.0", packages: ["rustls", "ring"] },
      { license: "MIT / Apache-2.0", packages: ["cbor4ii", "serde_yaml"] },
    ],
  },
  {
    kind: "npm",
    titleKey: "admin.about.sections.react",
    descriptionKey: "admin.about.sections.reactDesc",
    groups: [
      {
        license: "MIT",
        packages: [
          "react", "react-dom", "react-router-dom", "i18next", "react-i18next",
          "@radix-ui/themes", "monaco-editor", "sonner", "clsx",
          "tailwind-merge", "vite", "typescript",
        ],
      },
      { license: "ISC", packages: ["lucide-react"] },
      { license: "MIT", packages: ["@xterm/xterm"] },
    ],
  },
  {
    kind: "npm",
    titleKey: "admin.about.sections.vue",
    descriptionKey: "admin.about.sections.vueDesc",
    groups: [
      {
        license: "MIT",
        packages: [
          "vue", "vue-router", "pinia", "naive-ui", "echarts",
          "vue-echarts", "@vueuse/core", "unocss", "sass", "vite",
          "typescript",
        ],
      },
    ],
  },
];

function packageUrl(kind: "rust" | "npm", pkg: string): string {
  if (kind === "rust") {
    return `https://crates.io/crates/${encodeURIComponent(pkg.replaceAll(" ", ""))}`;
  }
  return `https://www.npmjs.com/package/${encodeURIComponent(pkg)}`;
}

const LEGAL = `法律声明与合规指引

重要提示
本文档旨在明确 Sakuio（“本软件”）的合法使用边界、用户权利义务与风险提示。请在下载、安装或使用本软件前，务必完整阅读并理解本声明的全部内容。一经下载、安装或使用，即视为您已理解并同意受本声明约束。

1. 适用范围
本声明适用于所有直接或间接获取、安装、访问或使用本软件及其衍生工具、文档与服务的自然人、法人或其他组织。

2. 定义
- “您/用户”：指任何以任何方式使用本软件的主体。
- “本软件/Sakuio”：指开源发布的 Sakuio Monitor 及相关组件、示例、脚本与文档。
- “目标设备”：指被您管理或操作的任何主机、服务器、虚拟机、容器或网络设备。

3. 许可与使用边界
本软件依据开源许可证（MIT）授权使用。除 MIT 许可另有规定外，本声明作为合规与风险提示的补充条款。
本软件仅用于合法、合规、经授权的系统管理、监测和研究目的。不得将本软件用于任何违反法律法规、监管政策或第三方合法权益之行为。
本软件不提供、亦不包含任何绕过安全控制、破解或渗透测试的隐含授权。进行安全测试前，您必须取得被测系统的事先明确书面授权。

4. 使用者责任（极其重要）
您对通过本软件进行的所有操作承担全部且唯一的法律责任。无论您的使用意图为何，只要行为发生，所产生的一切后果均由您自行承担，与本软件开发者无关。开发者不对您的使用方式进行审查、监控或背书，也不承担任何直接、间接或连带责任。

5. 严禁行为（包括但不限于）
5.1 未经授权的入侵、控制或访问任何计算机、服务器、网络或账户。
5.2 扫描端口、探测漏洞或从事任何未经授权的安全测试与信息收集。
5.3 发起或参与网络攻击（如 DoS/DDoS、流量劫持、嗅探、中间人攻击等）。
5.4 安装、分发或执行恶意代码、木马、后门、勒索软件或僵尸网络程序；利用被控设备进行挖矿、垃圾邮件发送、钓鱼或诈骗。
5.5 未经授权收集、处理、篡改、删除或泄露个人信息、商业秘密、知识产权或其他敏感数据；进行屏幕窥视、键盘记录、文件监听等监控行为。
5.6 传播任何违法或侵权内容，包括但不限于淫秽、暴力、恐怖主义、仇恨、歧视、诽谤或其他不当内容。
5.7 规避技术保护措施、逆向工程（法律允许范围除外）、干扰/破坏他人系统稳定性与可用性。

6. 合规与地区要求（特别说明）
您必须确保您的使用行为同时符合您所在地法律法规、目标设备所在地法律法规及相关行业监管规则与自律规范。
特别地，若您位于中国大陆地区，须严格遵守《网络安全法》《数据安全法》《个人信息保护法》《关键信息基础设施安全保护条例》等相关法律法规与标准。若您位于香港特别行政区、澳门特别行政区及台湾地区，亦须遵守当地适用之法律法规。任何违法或违规风险由您自行承担。

7. 数据与隐私合规
处理任何个人信息前，您应具备合法、正当、必要之处理依据，并履行告知、同意、最小化、目的限制、安全保障与跨境合规等义务。
若涉及敏感数据或机密信息，您应实施加密、脱敏、访问控制、日志审计等合理、必要的技术与管理措施。
为符合法律合规、安全审计、防滥用与争议处理之目的，在适用法律允许且必要时，我们可能会收集并保留最小化的网络元数据。该数据仅用于安全与法务合规用途，除法律纠纷外，我们不会主动分享您的数据。
数据安全与加密：我们在合理可行范围内采取行业通行的安全措施，以降低数据泄露、篡改与丢失风险。
除非基于法律法规要求、执法或监管部门的合法请求，或为保护我们及用户的合法权益所必需，我们不会向第三方披露前述数据。

8. 安全、内容与知识产权合规
您应确保对目标设备具有合法的管理权限或操作授权。
不得利用本软件侵犯任何第三方的知识产权、名誉权、隐私权或其他合法权益。
对于由您接入或展示的内容，您独立承担合规与版权责任。

9. 第三方组件与服务
本软件可能依赖第三方开源库或外部服务。该等第三方的可用性、准确性与合规性由其各自提供方负责。您应遵循相应许可或使用条款，并自行评估与承担相关风险。

10. 风险提示
本软件以“现状”提供，可能受限于网络、硬件、系统差异而产生不兼容、不可用或误用风险。
远程控制与批量操作具有潜在高风险，请务必采取最小权限、分级授权、多因素认证、审计留痕、分环境验证等最佳实践。

11. 免责声明
在适用法律允许的最大范围内：本软件及其开发者不对本软件的适用性、稳定性、正确性、可用性或特定目的适配性作出任何明示或默示保证；亦不对因使用或无法使用本软件而导致的任何形式的损失或损害承担责任。

12. 责任限制
在任何情况下，本软件开发者对您因本软件产生或与之相关的任何间接、偶然、特殊、惩罚性或后果性损害不承担责任；对任何直接损失的总责任（如有）以适用法律允许的最低上限为准。

13. 赔偿条款
若您因违反本声明或适用法律而引发任何第三方主张、索赔、纠纷或处罚，您应独立承担全部责任，并使本软件开发者及其贡献者免受损害。

14. 终止与技术支持
对于任何涉嫌或实际违反本声明的用户，开发者有权拒绝或终止提供任何形式的技术支持或协助。

15. 出口管制与制裁合规
您承诺遵守适用的出口管制、再出口与经济制裁法律法规，不得将本软件用于或提供给受限制的国家、地区、实体或个人。

16. 通知与修订
本声明可能随版本更新或法律政策变化进行修订。更新后的版本将以适当方式公布并自公布之日起生效。

17. 适用法律与争议解决
在不抵触强制性法律的前提下，本声明的解释与适用以本软件开源仓库维护者所在地法律为准；争议应友好协商解决，协商不成的，提交有管辖权的法院或仲裁机构处理。

18. 最终条款
若您不同意本声明任何内容，或无法确保您的使用完全合法合规，请立即停止使用并卸载本软件。继续使用即视为您已阅读、理解并同意本声明全部内容。

生效日期：2026-10-25`;

const LEGAL_EN = `Legal Notice and Compliance Guide

Important notice
This document defines the lawful use boundaries, user rights and obligations, and risk warnings for Sakuio (the "Software"). Read and understand the entire notice before downloading, installing or using the Software. Downloading, installing or using it constitutes acceptance of this notice.

1. Scope
This notice applies to all individuals, companies and other organizations that directly or indirectly obtain, install, access or use the Software, its derivatives, documentation or services.

2. Definitions
- "You/User": any party using the Software in any way.
- "Software/Sakuio": the open-source Sakuio Monitor project and related components, examples, scripts and documentation.
- "Target device": any host, server, virtual machine, container or network device you manage or operate.

3. License and scope of use
The Software is licensed under the MIT License. This notice is a compliance and risk supplement to that license.
The Software is intended only for lawful, compliant and authorized system administration, monitoring and research. It must not be used to violate laws, regulations or the lawful rights of third parties.
The Software does not grant any implied authorization to bypass security controls, crack systems or conduct penetration testing. You must obtain prior written authorization before security testing.

4. User responsibility (important)
You bear full and sole legal responsibility for all operations performed through the Software. Regardless of your intent, you are responsible for all consequences, and the developers are not responsible for how you use the Software. Developers do not review, monitor or endorse your use and accept no direct, indirect or joint liability.

5. Prohibited conduct (including but not limited to)
5.1 Unauthorized intrusion, control or access to any computer, server, network or account.
5.2 Port scanning, vulnerability probing or any unauthorized security testing or information gathering.
5.3 Initiating or participating in network attacks (DoS/DDoS, traffic hijacking, sniffing, man-in-the-middle attacks, etc.).
5.4 Installing, distributing or executing malicious code, Trojans, backdoors, ransomware or botnets; using controlled devices for mining, spam, phishing or fraud.
5.5 Unauthorized collection, processing, alteration, deletion or disclosure of personal information, trade secrets, intellectual property or other sensitive data; screen peeking, keylogging or file monitoring.
5.6 Distributing unlawful or infringing content, including obscene, violent, terrorist, hateful, discriminatory, defamatory or otherwise inappropriate content.
5.7 Circumventing technical protection measures, reverse engineering (except where permitted by law), or interfering with or damaging the stability and availability of others' systems.

6. Compliance and regional requirements
You must comply with the laws of your location, the laws of the target device's location, and applicable industry regulations and self-regulatory rules.
In particular, if you are located in mainland China, you must comply with the Cybersecurity Law, Data Security Law, Personal Information Protection Law, Regulations on the Security Protection of Critical Information Infrastructure and related standards. If you are located in Hong Kong, Macao, Taiwan or other regions, you must comply with applicable local laws. You bear all legal and regulatory risks.

7. Data and privacy compliance
Before processing personal information, you must have a lawful, legitimate and necessary basis and fulfill duties of notice, consent, minimization, purpose limitation, security protection and cross-border compliance.
For sensitive or confidential data, implement reasonable technical and organizational measures such as encryption, de-identification, access control and audit logging.
For legal compliance, security auditing, abuse prevention and dispute resolution, we may collect and retain minimal network metadata where permitted and necessary by law. It is used only for security and legal compliance and is not proactively shared except in legal disputes.
Data security and encryption: we take industry-standard security measures where reasonably practicable to reduce the risk of data leakage, tampering and loss.
We will not disclose such data to third parties except as required by laws, lawful requests from law enforcement or regulators, or as necessary to protect our rights and those of users.

8. Security, content and intellectual property
You must ensure you have lawful authority or authorization to manage target devices.
You must not use the Software to infringe any third party's intellectual property, reputation, privacy or other lawful rights.
You are solely responsible for compliance and copyright in content you connect or display.

9. Third-party components and services
The Software may depend on third-party open-source libraries or external services. Their availability, accuracy and compliance are the responsibility of their providers. You must comply with their licenses or terms and assess and bear the related risks.

10. Risk warning
The Software is provided "as is" and may be incompatible, unavailable or misused due to networks, hardware or system differences.
Remote control and batch operations carry high potential risk. Use least privilege, tiered authorization, multi-factor authentication, audit trails and environment-by-environment validation.

11. Disclaimer
To the maximum extent permitted by law, the Software and its developers make no express or implied warranties regarding fitness, stability, correctness, availability or fitness for a particular purpose, and accept no liability for any loss or damage arising from use or inability to use the Software.

12. Limitation of liability
Under no circumstances shall the developers be liable for any indirect, incidental, special, punitive or consequential damages arising from or related to the Software. The total liability for direct loss (if any) shall be limited to the minimum permitted by applicable law.

13. Indemnity
If you cause any third-party claim, demand, dispute or penalty by violating this notice or applicable law, you shall bear full responsibility and hold the developers and contributors harmless.

14. Termination and support
Developers may refuse or terminate technical support or assistance for users suspected of or actually violating this notice.

15. Export control and sanctions
You agree to comply with applicable export control, re-export and economic sanctions laws and must not use or provide the Software to restricted countries, regions, entities or individuals.

16. Notices and revisions
This notice may be revised as the version, legal or policy environment changes. Updated versions will be published appropriately and take effect on publication.

17. Governing law and dispute resolution
Without prejudice to mandatory law, this notice is governed by the law of the jurisdiction where the open-source repository maintainers are located. Disputes should be resolved through friendly negotiation; failing that, submit to a competent court or arbitration institution.

18. Final provisions
If you do not agree with any part of this notice or cannot ensure fully lawful and compliant use, stop using and uninstall the Software immediately. Continued use constitutes acceptance of this notice.

Effective date: 2026-10-25`;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function safeUrl(raw: string): string {
  const url = raw.trim();
  if (!url) return "";
  if (/^(https?:\/\/|\/|#)/i.test(url)) return url;
  return "";
}

function inlineMarkdown(value: string): string {
  return value
    .replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_match, alt: string, url: string) => {
      const src = safeUrl(url);
      return src ? `<img src="${src}" alt="${alt}" loading="lazy" />` : alt;
    })
    .replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_match, label: string, url: string) => {
      const href = safeUrl(url);
      return href ? `<a href="${href}" target="_blank" rel="noreferrer">${label}</a>` : label;
    })
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

function markdownToHtml(source: string): string {
  const prepared = source
    .replace(/<a\b[^>]*href="([^"]+)"[^>]*>\s*<img\b[^>]*src="([^"]+)"[^>]*alt="([^"]*)"[^>]*>\s*<\/a>/gis, "![$3]($2)")
    .replace(/<img\b[^>]*src="([^"]+)"[^>]*alt="([^"]*)"[^>]*>/gi, "![$2]($1)")
    .replace(/<a\b[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gis, "[$2]($1)")
    .replace(/<\/?a\b[^>]*>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n");

  // Keep the escaped text safe, but restore blockquote markers so `>` lines
  // are still recognized as Markdown after HTML escaping.
  const lines = escapeHtml(prepared).replaceAll("&gt;", ">").split(/\r?\n/);
  const out: string[] = [];
  let inCode = false;
  let list: "ul" | "ol" | null = null;
  const closeList = () => {
    if (list) {
      out.push(`</${list}>`);
      list = null;
    }
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trimEnd();
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      closeList();
      out.push(inCode ? "</code></pre>" : "<pre><code>");
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      out.push(`${line}\n`);
      continue;
    }
    if (!trimmed) {
      closeList();
      continue;
    }

    const alert = /^>\s*\[!(IMPORTANT|NOTE|WARNING|TIP|CAUTION)\]\s*$/i.exec(trimmed);
    if (alert) {
      closeList();
      const body: string[] = [];
      while (index + 1 < lines.length) {
        const next = lines[index + 1].trim();
        if (next.startsWith(">")) {
          index += 1;
          body.push(next.replace(/^>\s?/, ""));
          continue;
        }
        if (!next && index + 2 < lines.length && lines[index + 2].trim().startsWith(">")) {
          index += 1;
          continue;
        }
        break;
      }
      const kind = alert[1].toLowerCase();
      out.push(`<div class="about-alert about-alert--${kind}"><strong>${alert[1]}</strong><p>${inlineMarkdown(body.join(" "))}</p></div>`);
      continue;
    }

    const isTable = trimmed.startsWith("|") && index + 1 < lines.length
      && /^\|?\s*:?-{3,}/.test(lines[index + 1].trim());
    if (isTable) {
      closeList();
      const cells = (row: string) => row.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
      const header = cells(lines[index]);
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && lines[index].trim().startsWith("|")) {
        rows.push(cells(lines[index]));
        index += 1;
      }
      index -= 1;
      out.push(`<div class="about-table-wrap"><table><thead><tr>${header.map((cell) => `<th>${inlineMarkdown(cell)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${header.map((_, cellIndex) => `<td>${inlineMarkdown(row[cellIndex] ?? "")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
      continue;
    }

    if (/^\s*([-*_]\s*){3,}$/.test(line)) {
      closeList();
      out.push("<hr />");
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      closeList();
      const level = heading[1].length;
      out.push(`<h${level}>${inlineMarkdown(heading[2].replace(/\s+#+\s*$/, ""))}</h${level}>`);
      continue;
    }
    const quote = /^>\s?(.*)$/.exec(trimmed);
    if (quote) {
      closeList();
      out.push(`<blockquote>${inlineMarkdown(quote[1])}</blockquote>`);
      continue;
    }
    const ordered = /^\d+[.)]\s+(.*)$/.exec(trimmed);
    if (ordered) {
      if (list !== "ol") {
        closeList();
        out.push("<ol>");
        list = "ol";
      }
      out.push(`<li>${inlineMarkdown(ordered[1])}</li>`);
      continue;
    }
    const bullet = /^[-*+]\s+(.*)$/.exec(trimmed);
    if (bullet) {
      if (list !== "ul") {
        closeList();
        out.push("<ul>");
        list = "ul";
      }
      out.push(`<li>${inlineMarkdown(bullet[1])}</li>`);
      continue;
    }
    closeList();
    out.push(`<p>${inlineMarkdown(trimmed)}</p>`);
  }
  closeList();
  if (inCode) out.push("</code></pre>");
  return out.join("");
}

function legalToHtml(source: string): string {
  return escapeHtml(source)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (/^(法律声明与合规指引|重要提示|Legal Notice and Compliance Guide|Important notice)$/.test(line)) return `<h2>${line}</h2>`;
      if (/^\d+\.\s/.test(line)) return `<h3>${line}</h3>`;
      return `<p>${line}</p>`;
    })
    .join("");
}

export default function AboutPage() {
  const { t, i18n } = useTranslation();
  const [tab, setTab] = useState("about");
  const [readme, setReadme] = useState("");
  const [readmeLang, setReadmeLang] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fonts, setFonts] = useState({ global: "", number: "" });
  const [versionInfo, setVersionInfo] = useState<{
    version?: string;
    build_time?: string;
    build_commit?: string;
    agent_min?: string;
    agent_max?: string;
  }>({});

  useEffect(() => {
    fetch("/api/version", { credentials: "include" })
      .then(async (res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (body?.data) setVersionInfo(body.data);
      })
      .catch(() => undefined);
    const styles = getComputedStyle(document.documentElement);
    setFonts({
      global: styles.getPropertyValue("--font-family").trim(),
      number: styles.getPropertyValue("--font-family-number").trim(),
    });
  }, []);

  const readmeLanguage = i18n.language.startsWith("en") ? "en" : "zh-CN";

  useEffect(() => {
    if (tab !== "readme" || readmeLang === readmeLanguage) return;
    setLoading(true);
    setError("");
    setReadme("");
    const readmeFile = readmeLanguage === "en" ? "README.md" : "README_zh-cn.md";
    // Load the repository README itself, not a bundled copy.
    const readmeUrl = `https://raw.githubusercontent.com/sakuio-monitor/Sakuio/main/${readmeFile}`;
    fetch(readmeUrl)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setReadme(await res.text());
        setReadmeLang(readmeLanguage);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [tab, readmeLang, readmeLanguage]);

  const readmeHtml = useMemo(() => markdownToHtml(readme), [readme]);

  return (
    <section className="page-container about-page">
      <PageListHeader title={t("admin.about.title")} />
      <Tabs
        items={[
          { id: "about", label: t("admin.about.about") },
          { id: "readme", label: "README" },
          { id: "legal", label: t("admin.about.legal") },
        ]}
        value={tab}
        onChange={setTab}
        ariaLabel={t("admin.about.title")}
      />
      {tab === "about" ? (
        <article className="about-card page-card">
          <a
            className="about-title-link"
            href="https://github.com/sakuio-monitor/Sakuio"
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink size={20} aria-hidden />
            <h2>Sakuio Monitor</h2>
          </a>
          <div className="about-meta">
            <span>Copyright (C) 2026 Sakuio Contributors</span>
            <a href="https://opensource.org/licenses/MIT" target="_blank" rel="noreferrer">
              MIT License
            </a>
          </div>
          <p className="about-intro">{t("admin.about.intro")}</p>
          <p className="about-intro">
            Sakuio 是一个独立的开源服务器监控项目，前后端代码、数据模型和主题接口均由 Sakuio Contributors 维护。
          </p>
          <div className="about-system-cards">
            <div className="about-system-card">
              <span className="about-system-card__label">{t("admin.about.serverVersion")}</span>
              <strong className="about-system-card__value">{versionInfo.version ?? "—"}</strong>
              <small>
                {t("admin.about.buildTime")}：{" "}
                {versionInfo.build_time && versionInfo.build_time !== "0"
                  ? new Date(Number(versionInfo.build_time) * 1000).toLocaleString()
                  : t("admin.about.unknown")}
                {versionInfo.build_commit && versionInfo.build_commit !== "unknown" ? (
                  <a
                    className="about-commit-link"
                    href={`https://github.com/sakuio-monitor/Sakuio/commit/${versionInfo.build_commit}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    ({<ExternalLink size={12} aria-hidden />}
                    {versionInfo.build_commit})
                  </a>
                ) : null}
              </small>
            </div>
            <div className="about-system-card">
              <span className="about-system-card__label">{t("admin.about.agentRange")}</span>
              <strong className="about-system-card__value">
                {versionInfo.agent_min && versionInfo.agent_max
                  ? `${versionInfo.agent_min} ~ ${versionInfo.agent_max}`
                  : "—"}
              </strong>
              <small>{t("admin.about.agentRangeHint")}</small>
            </div>
          </div>
          <div className="about-fonts">
            <div className="about-font-row">
              <span className="about-font-label">{t("admin.about.globalFont")}</span>
              <code className="about-font-value">{fonts.global || t("admin.about.notConfigured")}</code>
            </div>
            <div className="about-font-row">
              <span className="about-font-label">{t("admin.about.numberFont")}</span>
              <code className="about-font-value about-font-value--number">{fonts.number || t("admin.about.notConfigured")}</code>
            </div>
          </div>
          <div className="about-license-grid">
            {LICENSE_SECTIONS.map((section) => (
              <section key={section.titleKey} className="about-license-card">
                <div className="about-license-card__header">
                  <h3>{t(section.titleKey)}</h3>
                  {section.descriptionKey ? <p>{t(section.descriptionKey)}</p> : null}
                </div>
                {section.groups.map((group) => (
                  <div key={group.license} className="about-license-group">
                    <span className="about-license-badge">{group.license}</span>
                    <div className="about-package-list">
                      {group.packages.map((pkg) => (
                        <a
                          key={pkg}
                          className="about-package"
                          href={packageUrl(section.kind, pkg)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <ExternalLink size={14} aria-hidden />
                          <span>{pkg}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            ))}
          </div>
          <div className="about-ai-note">
            <span className="about-ai-note__title">{t("admin.about.aiTitle")}</span>
            <p>{t("admin.about.aiNote")}</p>
          </div>
        </article>
      ) : null}
      {tab === "readme" ? (
        <article className="about-card page-card">
          {loading ? <p>Loading README…</p> : null}
          {error ? <p className="about-error">{error}</p> : null}
          {!loading && !error ? (
            <div className="about-markdown" dangerouslySetInnerHTML={{ __html: readmeHtml }} />
          ) : null}
        </article>
      ) : null}
      {tab === "legal" ? (
        <article className="about-card page-card">
          <div className="about-warning" role="alert">
            <AlertTriangle size={22} aria-hidden />
            <div>
              <strong>{t("admin.about.warningTitle")}</strong>
              <p>{t("admin.about.warning")}</p>
            </div>
          </div>
          <div
            className="about-legal"
            dangerouslySetInnerHTML={{ __html: legalToHtml(i18n.language.startsWith("en") ? LEGAL_EN : LEGAL) }}
          />
        </article>
      ) : null}
    </section>
  );
}
