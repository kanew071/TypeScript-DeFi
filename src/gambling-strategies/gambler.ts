import { BinanceConnector } from "../binance/binance-connector"
import { Player } from "./player"
import { IPortfolio, PortfolioProvider } from "./portfolio-provider"

export class Gambler {

    private portfolio: IPortfolio[] = []
    private binanceConnector: BinanceConnector
    private portfolioProvider: PortfolioProvider
    private liquidityRatioToBuy: number
    private liquidityRatioToSell: number

    public constructor(lrToBuy: number, lrToSell: number, binanceApiKey: string, binanceApiSecret: string) {
        this.liquidityRatioToBuy = lrToBuy
        this.liquidityRatioToSell = lrToSell
        this.binanceConnector = new BinanceConnector(binanceApiKey, binanceApiSecret)
        this.portfolioProvider = new PortfolioProvider()
        this.portfolio = this.portfolioProvider.getPortfolio()
    }

    public static gamble(lrToBuy: number, lrToSell: number, binanceApiKey: string, binanceApiSecret: string) {
        const i = new Gambler(lrToBuy, lrToSell, binanceApiKey, binanceApiSecret)
        if (lrToBuy < 0.6 || lrToSell > 0.4 || (binanceApiKey === undefined) || binanceApiSecret === undefined) {
            throw new Error(`Strange Parameters`)
        }
        setInterval(async () => {
            await i.investWisely()
        }, 11 * 1000)
    }

    private async investWisely() {

        const currentPrices = await this.binanceConnector.getCurrentPrices()
        const cPP = this.portfolioProvider.getCurrentPortfolioAveragePrice(currentPrices)
        const accountData = await this.binanceConnector.getFuturesAccountData()
        const liquidityRatio = accountData.availableBalance / accountData.totalWalletBalance
        const lowestPrice = this.portfolioProvider.getLowestPriceOfRecent100Intervals()
       
        console.log(`CPP: ${cPP}; lowestPrice: ${lowestPrice}; totalUnrealizedProfit: ${accountData.totalUnrealizedProfit} `)

        if (liquidityRatio <= this.liquidityRatioToSell) {
            await this.sell()
        } else if (liquidityRatio >= this.liquidityRatioToBuy &&  cPP === lowestPrice) {
            await this.buy(currentPrices, accountData)
        } else {
            console.log(`I'm reasonably invested. LR: ${liquidityRatio}; TWB: ${accountData.totalWalletBalance}`)
        }
         
    }

    private async buy(currentPrices: any[], accountData: any) {
        for (const listEntry of this.portfolio) {
            const currentPrice = currentPrices.filter((e: any) => e.coinSymbol === listEntry.pairName)[0].price
            const xPosition = accountData.positions.filter((entry: any) => entry.symbol === listEntry.pairName)[0]
            const canBuy = ((accountData.availableBalance * xPosition.leverage) / currentPrice) * (listEntry.percentage / 100)
            const couldBuyWouldBuyFactor = 0.1
            const howMuchToBuy = Number((canBuy * couldBuyWouldBuyFactor))
            console.log(`I'll buy ${howMuchToBuy} ${listEntry.pairName} as it has a portfolio percentage of ${listEntry.percentage}`)
            await this.binanceConnector.buyFuture(listEntry.pairName, Number(howMuchToBuy.toFixed(this.portfolioProvider.getDecimalPlaces(listEntry.pairName))))
        }
        // Player.playMP3(`${__dirname}/../../sounds/game-new-level.mp3`) // https://www.freesoundslibrary.com/cow-moo-sounds/ 
    }

    private async sell(positionSellFactor: number = 0.3) {
        const accountData = await this.binanceConnector.getFuturesAccountData()
        for (const position of accountData.positions) {
            if (position.positionAmt > 0) {
                const howMuchToSell = Number((position.positionAmt * positionSellFactor).toFixed(this.portfolioProvider.getDecimalPlaces(position.symbol)))
                console.log(`I'll sell ${howMuchToSell} ${position.symbol}`)
                await this.binanceConnector.sellFuture(position.symbol, howMuchToSell)
            }
        }
        // Player.playMP3(`${__dirname}/../../sounds/cow-moo-sound.mp3`) // https://www.freesoundslibrary.com/cow-moo-sounds/ 
    }

}
