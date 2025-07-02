const ms = require('ms');
const SteamUser = require('steam-user');
const SteamTotp = require('steam-totp');
const {
  LoginSession,
  EAuthSessionGuardType,
  EAuthTokenPlatformType,
  EResult,
} = require('steam-session');
const SteamAccount = require('../services/steam-account.service');
const { encrypt, decrypt } = require('../utils/crypto.util');
const { shuffleArray } = require('../utils/array.util');
const { isTokenExpired } = require('../utils/jwt.util');
const { STEAM_BOT_STATUS } = require('../constants');
const { logger } = require('../helpers/logger.helper');
const timestamp = require('../utils/timestamp.util');

class SteamBot {
  #sessionStart = null;
  #idleTimer    = null;
  #error;
  #status;
  #loginTimeout;
  #isRunning;
  #steamGuardAuth;
  #discordOwnerId;
  #username;
  #password;
  #sharedSecret;
  #refreshToken;
  #onlineStatus;
  #games;
  #vacStatus;
  #toBeRemoved;
  #toBeRestarted;

  #discordClient;

  constructor(account, discordClient) {
    this.#error = null;
    this.#status = STEAM_BOT_STATUS.IDLE;
    this.#loginTimeout = 3 * 60 * 1000;
    this.#isRunning = false;
    this.#steamGuardAuth = null;
    this.#discordOwnerId = account.discordOwnerId;
    this.#username = account.username;
    this.#password = account.password;
    this.#sharedSecret = account.sharedSecret;
    this.#refreshToken = account.refreshToken;
    this.#onlineStatus = account.onlineStatus;
    this.#games = account.games;
    this.#vacStatus = null;
    this.#toBeRemoved = false;
    this.#toBeRestarted = false;

    this.#discordClient = discordClient;

    this.steamUser = new SteamUser({
      dataDirectory: './accounts-data',
      singleSentryfile: false,
    });

    this.steamUser.on('loggedOn', this.onLoggedOn.bind(this));
    this.steamUser.on('steamGuard', this.onSteamGuardAuth.bind(this));
    this.steamUser.on('playingState', this.onPlayingState.bind(this));
    this.steamUser.on('vacBans', this.onVacBans.bind(this));
    this.steamUser.on('error', this.onError.bind(this));
    this.steamUser.on('disconnected', this.onDisconnected.bind(this));
  }

  replyDiscord(message) {
    const { sendDM } = this.#discordClient.functions;
    const msg = `**${this.getUsername()}** | ${message}`;
    sendDM(this.getDiscordOwnerId(), msg);
  }

  setError(error) {
    this.#error = error;
  }

  getError() {
    return this.#error;
  }

  setStatus(status) {
    this.#status = status;
  }

  getStatus() {
    return this.#status;
  }

  async setIsRunning(isRunning) {
    try {
      this.#isRunning = isRunning;
      await SteamAccount.setRunningStatus(this.getUsername(), this.#isRunning);
    } catch (error) {
      logger.error(`${this.getUsername()} | ${error}`);
      throw new Error('Failed to set running status on bot!');
    }
  }

  isRunning() {
    return this.#isRunning;
  }

  setSteamGuardAuth(steamGuardAuth = null) {
    this.#steamGuardAuth = steamGuardAuth;
  }

  getSteamGuardAuth() {
    return this.#steamGuardAuth;
  }

  setDiscordOwnerId(discordOwnerId) {
    this.#discordOwnerId = discordOwnerId;
  }

  getDiscordOwnerId() {
    return this.#discordOwnerId;
  }

  setUsername(username) {
    this.#username = username;
  }

  getUsername() {
    return this.#username;
  }

  setSharedSecret(sharedSecret, doEncrypt = true) {
    this.#sharedSecret = doEncrypt ? encrypt(sharedSecret) : sharedSecret;
  }

  getSharedSecret() {
    return decrypt(this.#sharedSecret);
  }

  async setRefreshToken(refreshToken, doEncrypt = true) {
    try {
      this.#refreshToken = doEncrypt ? encrypt(refreshToken) : refreshToken;
      await SteamAccount.setRefreshToken(this.getUsername(), this.#refreshToken);
    } catch (error) {
      logger.error(`${this.getUsername()} | ${error}`);
      throw new Error('Failed to set refresh token on bot!');
    }
  }

  getRefreshToken() {
    return decrypt(this.#refreshToken);
  }

  setOnlineStatus(onlineStatus) {
    this.#onlineStatus = onlineStatus;
  }

  getOnlineStatus() {
    return this.#onlineStatus;
  }

  async setGames(newGames) {
    this.#games = newGames;
  }


  getGames() {
    return this.#games;
  }

  setVacStatus(vacStatus) {
    this.#vacStatus = vacStatus;
  }

  getVacStatus() {
    return this.#vacStatus;
  }

  async inputSteamGuardCode(code) {
    if (!this.getSteamGuardAuth()) return;
    const { callback } = this.getSteamGuardAuth();

    try {
      await callback(code);
    } catch (error) {
      switch (error.eresult) {
        case EResult.InvalidLoginAuthCode:
          this.replyDiscord('Invalid Steam Guard Email code!');
          return;
        case EResult.TwoFactorCodeMismatch:
          this.replyDiscord('Invalid Steam Guard Mobile Authenticator code!');
          if (this.getSharedSecret()) {
            this.replyDiscord('Either your Steam Guard Mobile code is wrong or your shared secret is invalid!');
          }
          return;
        default:
          logger.error(`${this.getUsername()} | Unhandled error while authenticating Steam Guard: ${error?.message} (${error?.eresult}) - ${error}`);
          this.replyDiscord(`ERROR: Unhandled error while authenticating Steam Guard: ${error?.message} (${error?.eresult})!`);
          break;
      }
      throw error;
    }
  }

  getSteamId64() {
    return this.steamUser.steamID.getSteamID64();
  }

  #login(isRestart = false) {
    try {
      const loginMsg = isRestart ? 'ℹ️ Automatically restarting...' : 'Logging in using refresh token...';
      this.replyDiscord(loginMsg);

      this.steamUser.logOn({
        refreshToken: this.getRefreshToken(),
        machineName: `SHBD-${this.getDiscordOwnerId()}`,
        clientOS: SteamUser.EOSType.Windows10,
      });
    } catch (error) {
      logger.error(`${this.getUsername()} | ${error}`);
      this.setError(STEAM_BOT_STATUS.LOGIN_ERROR);
      this.replyDiscord('Error while logging in!');
    }
  }

  async initSteamSession(isRestart = false) {
    try {
      if (this.getRefreshToken() && !isTokenExpired(this.getRefreshToken())) {
        this.#login(isRestart);
        return;
      }

      this.replyDiscord('Getting new refresh token...');

      const steamSession = new LoginSession(EAuthTokenPlatformType.SteamClient);
      steamSession.loginTimeout = this.#loginTimeout;

      const { actionRequired, validActions } = await steamSession.startWithCredentials({
        accountName: this.getUsername(),
        password: decrypt(this.#password),
      });

      if (actionRequired) {
        const promptingGuards = validActions.filter((a) =>
          [EAuthSessionGuardType.EmailCode, EAuthSessionGuardType.DeviceCode].includes(a.type)
        );

        for (const action of promptingGuards) {
          this.setSteamGuardAuth({ isSessionSteamGuard: true, callback: (code) => steamSession.submitSteamGuardCode(code) });

          if (action.type === EAuthSessionGuardType.EmailCode) {
            this.replyDiscord(`Steam Guard Email (${action?.detail}) Code required! Use \`/boost steam-guard\``);
          } else if (action.type === EAuthSessionGuardType.DeviceCode) {
            if (this.getSharedSecret()) {
              const authCode = SteamTotp.getAuthCode(this.getSharedSecret());
              this.replyDiscord(`Trying using generated Steam Guard Code: \`${authCode}\``);
              this.inputSteamGuardCode(authCode);
            } else {
              this.replyDiscord('Steam Guard Mobile Code required! Use `/boost steam-guard`.');
            }
          }
        }
      }

      steamSession.on('authenticated', async () => {
        await this.setRefreshToken(steamSession.refreshToken);
        this.#login(isRestart);
      });

      steamSession.on('timeout', () => {
        this.setSteamGuardAuth(null);
        this.replyDiscord(`Login timed out! Try again. (Timeout: \`${ms(this.#loginTimeout, { long: true })}\`)`);
      });

      steamSession.on('error', (error) => {
        this.setSteamGuardAuth(null);
        logger.error(`${this.getUsername()} | Login error: ${error}`);
        this.replyDiscord(`ERROR: Login failed! ${error?.message ?? error}`);
      });
    } catch (error) {
      if (error.eresult === EResult.InvalidPassword) {
        this.replyDiscord('ERROR: Invalid password while logging in!');
        return;
      }

      logger.error(`${this.getUsername()} | Login failure: ${error?.message} (${error?.eresult})`);
      this.replyDiscord(`ERROR: Login failed: ${error?.message} (${error?.eresult})`);
      throw error;
    }
  }

  start(isRestart = false) {
    try {
      this.setStatus(STEAM_BOT_STATUS.LOGGING_IN);
      this.initSteamSession(isRestart);
    } catch (error) {
      logger.error(`${this.getUsername()} | ${error}`);
      this.setError(STEAM_BOT_STATUS.LOGIN_ERROR);
      this.replyDiscord('Error while starting bot!');
    }
  }

async stop(removeAccount = false) {
  try {
    this.setStatus(STEAM_BOT_STATUS.LOGGING_OUT);
    this.replyDiscord('Logging out...');

    this.#toBeRemoved = removeAccount;

    // Stop playing games explicitly
    this.steamUser.gamesPlayed([]);

    // Stop tracking idle time
    clearInterval(this.#idleTimer);

    // Flush idle hours (awaited)
    await this.#flushIdle();

    // Actually log off from Steam
    this.steamUser.logOff();

    // Manually update running state to prevent dangling boosting status
    await this.setIsRunning(false);

    this.setStatus(STEAM_BOT_STATUS.LOGGED_OUT);
    this.replyDiscord('Successfully logged out!');
  } catch (error) {
    logger.error(`${this.getUsername()} | ${error}`);
    this.setError(STEAM_BOT_STATUS.LOGOUT_ERROR);
    this.replyDiscord('Error while logging out!');
  }
}



  restart() {
    try {
      this.setStatus(STEAM_BOT_STATUS.RESTART);
      this.#toBeRestarted = true;
      this.steamUser.logOff();
    } catch (error) {
      logger.error(`${this.getUsername()} | ${error}`);
      this.setError(STEAM_BOT_STATUS.RESTART_ERROR);
      this.replyDiscord('Error while restarting!');
    }
  }

  async onLoggedOn(details) {
    try {
      if (details.eresult === SteamUser.EResult.OK) {
        this.setStatus(STEAM_BOT_STATUS.LOGGED_IN);
        await this.setIsRunning(true);
        this.setSteamGuardAuth(null);
        this.steamUser.setPersona(
          this.getOnlineStatus() ? SteamUser.EPersonaState.Online : SteamUser.EPersonaState.Invisible
        ); 

        this.replyDiscord(`Successfully logged on as \`${this.getSteamId64()}\`!`);
        this.steamUser.gamesPlayed(shuffleArray(this.getGames()));
        this.replyDiscord(`Started playing \`${JSON.stringify(this.getGames())}\`!`);
        this.setStatus(STEAM_BOT_STATUS.BOOST_STARTED);
        this.#sessionStart = Date.now();
        this.#idleTimer = setInterval(() => this.#flushIdle(), 5 * 60 * 1000);

      } else {
        this.setStatus(STEAM_BOT_STATUS.UnhandledLoggedInEvent(details?.eresult));
        logger.warn(`${this.getUsername()} | Unhandled loggedOn event: (${details?.eresult})`);
        this.replyDiscord(`Unhandled logged on event: (${details?.eresult})`);
      }
    } catch (error) {
      logger.error(`${this.getUsername()} | ${error}`);
      this.setError(STEAM_BOT_STATUS.Error(error));
      this.replyDiscord('Error after logging in!');
    }
  }

async #flushIdle() {
  if (!this.#sessionStart) return;

  const elapsedMs  = Date.now() - this.#sessionStart;
  const elapsedHrs = elapsedMs / 3_600_000;

  if (elapsedHrs < 1 / 60) return;

  try {
    const games = this.#games || []; // Add this line — get the games list
    await SteamAccount.addIdleHours(this.getUsername(), elapsedHrs, games);
    this.#sessionStart = Date.now();
  } catch (err) {
    logger.error(`[flushIdle] Failed for ${this.getUsername()}: ${err}`);
  }
}


  onSteamGuardAuth() {
    this.setStatus(STEAM_BOT_STATUS.STEAM_GUARD_REQUIRED);
    this.start();
  }

  onPlayingState(blocked, playingApp) {
    if (blocked) {
      this.replyDiscord(`Game is being played in another session (AppID: ${playingApp})`);
      this.setStatus(STEAM_BOT_STATUS.BlockedFromPlayingGames(playingApp));
    }
  }

  onVacBans(numBans, appids) {
    if (numBans > 0) {
      this.setVacStatus({ numBans, appids });
    }
  }

  async onError(error) {
    try {
      this.setError(STEAM_BOT_STATUS.Error(error));
      await this.setIsRunning(false);
      this.setSteamGuardAuth(null);

      switch (error.eresult) {
        case SteamUser.EResult.InvalidPassword:
          await this.#flushIdle();
          clearInterval(this.#idleTimer);
          this.setError(STEAM_BOT_STATUS.INVALID_PASSWORD);
          this.replyDiscord('ERROR: Invalid password!');
          this.stop();
          this.replyDiscord('Boost stopped! WARNING: Check your password.');
          return;

        case SteamUser.EResult.LoggedInElsewhere:
          await this.#flushIdle();
          clearInterval(this.#idleTimer);
          this.setError(STEAM_BOT_STATUS.ERROR_LOGGED_IN_ELSEWHERE);
          this.replyDiscord('ERROR: Logged in elsewhere!');
          break;

        case SteamUser.EResult.AccountLogonDenied:
          await this.#flushIdle();
          clearInterval(this.#idleTimer);
          this.setError(STEAM_BOT_STATUS.STEAM_GUARD_REQUIRED);
          this.replyDiscord('ERROR: Steam Guard required!');
          break;

        case SteamUser.EResult.AccountHasBeenDeleted:
          await this.#flushIdle();
          clearInterval(this.#idleTimer);
          this.setError(STEAM_BOT_STATUS.ERROR_ACCOUNT_DELETED);
          this.replyDiscord('ERROR: Account has been deleted!');
          this.stop();
          return;

        case SteamUser.EResult.LogonSessionReplaced:
          await this.#flushIdle();
          clearInterval(this.#idleTimer);
          this.setError(STEAM_BOT_STATUS.ERROR_LOGON_SESSION_REPLACED);
          this.replyDiscord('ERROR: Logon session replaced! Stopping.');
          this.stop();
          break;

        default:
          await this.#flushIdle();
          clearInterval(this.#idleTimer);
          this.setRefreshToken('');
          this.setError(STEAM_BOT_STATUS.Error(error));
          logger.warn(`${this.getUsername()} | Unhandled error event: ${error?.message} (${error?.eresult})`);
          this.replyDiscord(`ERROR: Unhandled error event, please restart your bot: ${error?.message} (${error?.eresult})`);
          this.stop();
          break;
      }

      // this.replyDiscord('Reconnecting in 40 minutes...');
      // setTimeout(() => {
      //   this.replyDiscord('Reconnecting...');
      //   this.start(true);
      // }, 40 * 60 * 1000);
    } catch (err) {
      logger.error(`${this.getUsername()} | ${err}`);
      this.setError(STEAM_BOT_STATUS.Error(err));
      this.replyDiscord('Error!');
    }
  }

  async onDisconnected() {
    if (!this.#toBeRemoved && this.#isRunning) {
      await this.setIsRunning(false);
    }

    clearInterval(this.#idleTimer);
    this.setStatus(STEAM_BOT_STATUS.DISCONNECTED);

    if (!this.#toBeRemoved) {
      await this.setIsRunning(false);
      this.setSteamGuardAuth(null);
    }

    if (this.#toBeRestarted) {
      this.#toBeRestarted = false;
      await this.setIsRunning(false);
      this.setSteamGuardAuth(null);
      this.start(true);
    }
  }
}

module.exports = SteamBot;
