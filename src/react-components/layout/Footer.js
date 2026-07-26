import React from "react";
import PropTypes from "prop-types";
import { FormattedMessage } from "react-intl";
import styles from "./Footer.scss";
import discordLogoUrl from "../../assets/images/discord-logo-small.png";
import { Container } from "./Container";
import configs from "../../utils/configs";
import { AppLogo } from "../misc/AppLogo";

export function Footer({
  hidePoweredBy,
  showWhatsNewLink,
  showTerms,
  termsUrl,
  showPrivacy,
  privacyUrl,
  showCompanyLogo,
  companyLogoUrl,
  showDiscordBotLink,
  appName
}) {
  const tagline =
    configs.translation("app-description") || "Chemie lernen in 3D – interaktive VR-Räume für den Chemieunterricht";

  return (
    <footer>
      <Container as="div" className={styles.container}>
        <div className={styles.brand}>
          <a href="/" className={styles.logoLink}>
            <AppLogo />
          </a>
          <p className={styles.tagline}>{tagline}</p>
        </div>
        <div className={styles.poweredBy}>
          {!hidePoweredBy && (
            <span>
              <FormattedMessage
                id="footer.powered-by"
                defaultMessage="Powered by <a>{appName}</a>"
                values={{
                  appName,
                  a: chunks => (
                    <a className={styles.link} href={configs.link("home", "/")}>
                      {chunks}
                    </a>
                  )
                }}
              />
            </span>
          )}
        </div>
        <nav>
          <ul>
            {showDiscordBotLink && (
              <li>
                <img className={styles.discordLogo} src={discordLogoUrl} />
                <a href="/discord">
                  <FormattedMessage
                    id="home-page.add-to-discord"
                    defaultMessage="Add the {appName} Bot to Discord"
                    values={{
                      appName
                    }}
                  />
                </a>
              </li>
            )}
            {showWhatsNewLink && (
              <li>
                <a href="/whats-new">
                  <FormattedMessage id="footer.whats-new" defaultMessage="What's New" />
                </a>
              </li>
            )}
            {showTerms && (
              <li>
                <a target="_blank" rel="noopener noreferrer" href={termsUrl}>
                  <FormattedMessage id="footer.terms-of-use" defaultMessage="Terms of Use" />
                </a>
              </li>
            )}
            {showPrivacy && (
              <li>
                <a className={styles.link} target="_blank" rel="noopener noreferrer" href={privacyUrl}>
                  <FormattedMessage id="footer.privacy-notice" defaultMessage="Privacy Notice" />
                </a>
              </li>
            )}
            {showCompanyLogo && (
              <li>
                <img
                  className={styles.companyLogo}
                  src={companyLogoUrl}
                  alt={<FormattedMessage id="footer.logo-alt" defaultMessage="Logo" />}
                />
              </li>
            )}
          </ul>
        </nav>
      </Container>
    </footer>
  );
}

Footer.propTypes = {
  hidePoweredBy: PropTypes.bool,
  showWhatsNewLink: PropTypes.bool,
  showTerms: PropTypes.bool,
  termsUrl: PropTypes.string,
  showPrivacy: PropTypes.bool,
  privacyUrl: PropTypes.string,
  showCompanyLogo: PropTypes.bool,
  companyLogoUrl: PropTypes.string,
  showDiscordBotLink: PropTypes.bool,
  appName: PropTypes.string,
  isHmc: PropTypes.bool
};
