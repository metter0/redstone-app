import {
  hexToDate,
  parseUnixTime,
  getTimeUntilNextHeartbeat,
  timeUntilDate,
  findNearestCronDate,
} from "@/core/timeHelpers";
import { getUnixTime, intervalToDuration, formatDuration } from "date-fns";
import cronstrue from "cronstrue";
import networks from "@/data/networks.json";
import tokens from "@/config/tokens.json";

export const images = Object.keys(tokens).map((token) => ({
  token,
  ...tokens[token],
}));

const excludedFeeds = [{feed: 'ETHx', chainId: 1}]

export const mapFeedsData = (storeFeedsArray) => {
  if (storeFeedsArray?.length === 0) return [];
  const feedsWithoutExcluded = storeFeedsArray.filter(feed => 
    !excludedFeeds.some(excluded => 
      excluded.feed === feed.feedId && excluded.chainId === feed.networkId
    )
  );
  return feedsWithoutExcluded.map((item) => {
    const answerCurrency = item.feedId.split("/")[1];
    return {
      answer: parseToDecimal(item.value),
      feed: hasSlash(item.feedId)
        ? item.feedId
        : item.feedId + "/" + resolveDenomination(item.feedId),
      timestamp: getTimestampValue(item),
      heartbeat: getHeartbeatValue(item),
      deviation: getDeviationValue(item),
      crypto_token: removeSeparators(item.feedId),
      token_image: getTokenImage(item.feedId),
      popularity: getPopularityValue(item),
      contract_address: item.contractAddress,
      heartbeatTitle: heartbeatTitle(item),
      cron: item.triggers.cron,
      layer_id: item.feedId,
      token: item.feedId,
      relayerId: item.layerId,
      feed_address: item.feedAddress,
      loaders: item.loaders,
      apiValues: item.apiValues,
      contractAnswer: parseToCurrency(
        parseToDecimal(item.value),
        answerCurrency,
        item.feedId
      ),
      apiAnswer: parseToCurrency(
        item.apiValues?.value * 100000000,
        answerCurrency,
        item.feedId
      ),
      network: {
        id: item.networkId,
        name: findNetworkName(item.networkId),
        image: findNetworkImage(item.networkId),
      },
      explorer: {
        name: findNetworkName(item.networkId),
        explorerUrl: findExplorer(item.networkId),
      },
    };
  });
};

const resolveTimestampForHeartbeat = (item) => {
  if (item?.apiValues?.timestamp != null) {
    const unixTimestamp = Math.floor(
      new Date(item.apiValues.timestamp).getTime() / 1000
    );
    return "0x" + unixTimestamp.toString(16).padStart(8, "0");
  } else if (item?.timestamp) {
    return item.timestamp;
  } else {
    return (
      "0x" +
      Math.floor(Date.now() / 1000)
        .toString(16)
        .padStart(8, "0")
    );
  }
};

const resolveDenomination = (token) => {
  return denominationCustomMap?.[token] || "USD";
};

const getHeartbeatValue = (item) =>
  getTimeUntilNextHeartbeat(
    resolveTimestampForHeartbeat(item),
    resolveTimeSinceLastUpdateInMilliseconds(item)
  ) || JSON.stringify(item.triggers.cron);

const getTimestampValue = (item) => ({
  parsed: parseUnixTime(item.timestamp),
  raw: item.timestamp,
  date: hexToDate(item.timestamp),
});

const getDeviationValue = (item) =>
  resolveDeviationPercentage(item) != "n/a"
    ? resolveDeviationPercentage(item) + "%"
    : "n/a";

const getPopularityValue = (item) =>
  `${networkOrder().findIndex((network) => item.networkId === network.chainId)}_${cryptoOrder().findIndex((crypto) => removeSeparators(item.feedId) === crypto.token)}`;

const parseToDecimal = (hexValue) => {
  hexValue = hexValue?.replace(/^0x/, "");
  return parseInt(hexValue, 16);
};

export const hasSlash = (string) => {
  return string.indexOf("/") >= 0;
};

const removeSeparators = (string) => {
  const noSlash = string.split("/")[0];
  const noUnder = noSlash.split("_")[0];
  const noSeparators = noUnder.split("-")[0];
  return noSeparators;
};

export const findNetworkName = (networkId) => {
  return Object.values(networks).find(
    (network) => network.chainId === networkId
  ).name;
};

export const findNetworkImage = (networkId) => {
  return Object.values(networks).find(
    (network) => network.chainId === networkId
  ).iconUrl;
};

const findNetwork = (networkId) => {
  return Object.values(networks).find(
    (network) => network.chainId === networkId
  );
};

const findExplorer = (networkId) => {
  const hasExplorer = Object.values(networks).some(
    (network) => network.chainId === networkId
  );
  if (!hasExplorer) console.warn("Missing explorer for chain:", networkId);
  return Object.values(networks).find(
    (network) => network.chainId === networkId
  ).explorerUrl;
};

const msToTime = (ms) => {
  const duration = intervalToDuration({ start: 0, end: ms });
  const { minutes } = duration;

  const totalHours = Math.floor(ms / (1000 * 60 * 60));

  if (totalHours > 0) {
    return formatDuration({ hours: totalHours, minutes }, { format: ["hours", "minutes"] });
  } else {
    return formatDuration({ minutes }, { format: ["minutes"] });
  }
};

const transformHexString = (str) => {
  if (str == null) return "no data";
  if (str?.length <= 10) return str;
  return `${str?.slice(0, 7)} . . . ${str?.slice(-4)}`;
};

export const getTokenImage = (token) => {
  const idealMatchImg = images.find((image) => token === image.token);
  const secondMatch = images.find(
    (image) => token.split("/")[0] === image.token
  );
  return (
    idealMatchImg ||
    secondMatch || {
      name: "placeholder",
      logoURI: "https://raw.githubusercontent.com/redstone-finance/redstone-images/main/symbols/placeholder.png",
      token: "placeholder",
    }
  );
};

export const createNetworkUrlParam = (networkName) => {
  return networkName.toLowerCase().replace(" ", "-");
};

export const processTokenData = (data) => {
  const tokenMap = new Map();
  data.forEach(({ token, network }) => {
    const tokens = token.includes("/") ? token.split("/") : [token];
    tokens.forEach((t) => {
      if (!tokenMap.has(network)) {
        tokenMap.set(network, new Set());
      }
      tokenMap.get(network).add(t);
    });
  });
  const processedData = [];
  for (const [network, tokens] of tokenMap.entries()) {
    tokens.forEach((token) => {
      processedData.push({ token, network });
    });
  }
  return processedData;
};

const resolveDeviationPercentage = (item) => {
  const triggerOverride = item.overrides.filter(
    (override) => override.value !== undefined
  );
  const deviationPercentage =
    triggerOverride.length > 0
      ? triggerOverride[0]?.value ||
        triggerOverride[0].value.deviationPercentage
      : item.triggers.deviationPercentage;
  return deviationPercentage
    ? deviationPercentage?.deviationPercentage || deviationPercentage
    : "n/a";
};

const heartbeatTitle = (item) => {
  const heartbeat = resolveTimeSinceLastUpdateInMilliseconds(item);
  const crons = item.triggers.cron;
  if (crons) {
    return crons.map((cron) => cronstrue.toString(cron)).join(", ");
  } else {
    return "Heartbeat: " + msToTime(heartbeat);
  }
};

const resolveTimeSinceLastUpdateInMilliseconds = (item) => {
  const triggerOverride = item.overrides.filter(
    (override) => override.value !== undefined
  );
  const timeSinceLastUpdateInMilliseconds =
    triggerOverride.length > 0 &&
    triggerOverride[0]?.type === "full" &&
    triggerOverride[0]?.value?.timeSinceLastUpdateInMilliseconds !== undefined
      ? triggerOverride[0].value.timeSinceLastUpdateInMilliseconds
      : item.triggers.timeSinceLastUpdateInMilliseconds;

  return timeSinceLastUpdateInMilliseconds;
};

export const nearestCron = (cronString) => {
  if (cronString == null) {
    return 0;
  }
  try {
    const parsedCron = JSON.parse(cronString);
    const nearestDate = findNearestCronDate(parsedCron);
    const timeUntil = timeUntilDate(nearestDate);
    return timeUntil;
  } catch (error) {
    console.error("Error parsing cron string:", error);
    return "Invalid cron";
  }
};

export const heartbeatIsNumber = (value) => {
  return !isNaN(value);
};

export const denominationCustomMap = {
  "wstETH_FUNDAMENTAL": "USD",
  "uniETH_FUNDAMENTAL": "USD",
  "deUSD_FUNDAMENTAL": "USD",
  "pufETH_FUNDAMENTAL": "ETH",
  "pzETH_FUNDAMENTAL": "ETH",
  "mETH_FUNDAMENTAL": "ETH",
  "LBTC_FUNDAMENTAL": "BTC",
  "ETH_CLE": "ETH",
  "ETH_ELE": "ETH",
  "ETH_CLE+": "ETH",
  "sUSDe_RATE_PROVIDER": "USDe",
  "SolvBTC_MERLIN": "USD",
  "SolvBTC.BBN": "USD",
  "SolvBTC_BNB": "USD",
  "BBTC": "USD",
  "BBUSD": "USD",
  "PREMIA-TWAP-60": "USD",
  "ezETH-TWAP-60": "USD",
  "USDB-TWAP-30": "USD",
  "SolvBTC_MERLIN/BTC-TWAP-60": "BTC",
  weETH_FUNDAMENTAL: "ETH",
  apxETH: "USD",
  "ETH+": "USD",
  sfrxETH: "USD",
  "sfrxETH/ETH": "ETH",
  "eBTC/WBTC": "BTC",
};

export const parseToCurrency = (decimalValue, currency, token) => {
  const sUSDe_RATE = token === 'sUSDe_RATE_PROVIDER'
  const value = decimalValue / Math.pow(10, sUSDe_RATE ? 18 : 8)
  const customDenomination = denominationCustomMap?.[token];
  const finalCurrency = customDenomination || currency;
  let formatterOptions = {
    style: "currency",
    currency: "USD",
  };
  if (value >= 1) {
    formatterOptions.minimumFractionDigits = 3;
    formatterOptions.maximumFractionDigits = 3;
  } else {
    formatterOptions.notation = "standard";
    formatterOptions.minimumSignificantDigits = 4;
    formatterOptions.maximumSignificantDigits = 4;
  }
  const formatter = new Intl.NumberFormat("en-US", formatterOptions);
  let formattedValue = formatter.format(value);
  if (finalCurrency && currency !== "USD") {
    switch (finalCurrency) {
      case "EUR":
        formattedValue = formattedValue.replace("$", "€");
        break;
      case "ETH":
        formattedValue = formattedValue.replace("$", "Ξ");
        break;
      case "BRL":
        formattedValue = formattedValue.replace("$", "R$");
        break;
      case "GBP":
        formattedValue = formattedValue.replace("$", "£");
        break;
      case "BTC":
        formattedValue = formattedValue.replace("$", "₿");
        break;
      case "USD":
        break;
      case "USDe":
        formattedValue = formattedValue.replace("$", "") + 'USDe';
        break;
      default:
        formattedValue = formattedValue.replace("$", "") + currency;
        break;
    }
  }
  return formattedValue;
};

const networkOrder = () => {
  return Object.values(networks);
};
const cryptoOrder = () => {
  return Object.values(images);
};
