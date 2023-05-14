import {Builder, Cell, CellMessage, CommonMessageInfo, InternalMessage, toNano} from "ton";
import BN from "bn.js";
import {NftAuctionV2Data} from "./NftAuctionV2.data";
import {NftAuctionV2Local} from "./NftAuctionV2Local";
import "../nft-auction/test-tools";
import {isTransferPayload, makeBid} from "../nft-auction/test-tools";
import { randomAddress } from "../../utils/randomAddress";

describe('auction v2 sale contract', () => {
    let defaultConfig: NftAuctionV2Data = {
        marketplaceFeeAddress: randomAddress(),
        marketplaceFeeFactor: new BN(5),
        marketplaceFeeBase: new BN(100),


        royaltyAddress: randomAddress(),
        royaltyFactor: new BN(20),
        royaltyBase: new BN(100),


        minBid: toNano('1'),
        maxBid: toNano('100'),
        minStep: toNano('1'),
        endTimestamp: 1655880000, // 22 June 2022 г., 6:40:00

        stepTimeSeconds: 60 * 5,
        tryStepTimeSeconds: 60 * 5,

        nftOwnerAddress: null,
        nftAddress: randomAddress(),

        end: true,
        marketplaceAddress: randomAddress(),
        activated: false,
        createdAtTimestamp: 1655880000 - (60 * 60),
    }
    it('return get_sale_data', async () => {
        const auc = await NftAuctionV2Local.createFromConfig(defaultConfig);
        const res = await auc.getSaleData();

        expect(res.end).toEqual(defaultConfig.end);
        expect(res.endTimestamp).toEqual(defaultConfig.endTimestamp);
        expect(res.marketplaceAddress.equals(defaultConfig.marketplaceAddress)).toEqual(true);
        expect(res.nftAddress.equals(defaultConfig.nftAddress)).toEqual(true);
        expect(res.nftOwnerAddress).toEqual(null);
        expect(res.lastBidAmount.eq(new BN(0))).toEqual(true);
        expect(res.lastBidAddress).toEqual(null);
        expect(res.minStep.eq(defaultConfig.minStep)).toEqual(true);
        expect(res.marketplaceFeeAddress.equals(defaultConfig.marketplaceFeeAddress)).toEqual(true);
        expect(res.marketplaceFeeFactor.eq(defaultConfig.marketplaceFeeFactor)).toEqual(true);
        expect(res.marketplaceFeeBase.eq(defaultConfig.marketplaceFeeBase)).toEqual(true);
        expect(res.royaltyAddress.equals(defaultConfig.royaltyAddress)).toEqual(true);
        expect(res.royaltyFactor.eq(defaultConfig.royaltyFactor)).toEqual(true);
        expect(res.royaltyBase.eq(defaultConfig.royaltyBase)).toEqual(true);
        expect(res.maxBid.eq(defaultConfig.maxBid)).toEqual(true);
        expect(res.isCanceled).toEqual(false);
    });

    it('deploy start bid end', async () => {
        const auc = await NftAuctionV2Local.createFromConfig(defaultConfig);
        auc.contract.setC7Config({
            myself: auc.address,
            unixtime: defaultConfig.createdAtTimestamp,
        })

        const res = await auc.getSaleData();
        expect(res.end).toEqual(true);

        const prevOwner = randomAddress()
        let nftOwnershipAssignedCell = new Cell()
        nftOwnershipAssignedCell.bits.writeUint(0x05138d91, 32) // ownership_assigned
        nftOwnershipAssignedCell.bits.writeUint(0, 64) // query_id
        nftOwnershipAssignedCell.bits.writeAddress(prevOwner) // prev_owner

        const startResult = await auc.contract.sendInternalMessage(new InternalMessage({
            to: auc.address,
            from: res.nftAddress,
            value: toNano('0.05'),
            bounce: true,
            body: new CommonMessageInfo({
                body: new CellMessage(nftOwnershipAssignedCell)
            })
        }));

        expect(startResult).toOkExecuted()

        {
            const res = await auc.getSaleData();
            expect(res.end).toEqual(false);
            expect(res.endTimestamp).toEqual(defaultConfig.endTimestamp);
            expect(res.endTimestamp).toBeGreaterThan(defaultConfig.createdAtTimestamp)
            expect(res.nftOwnerAddress?.equals(prevOwner)).toEqual(true);
            expect(res.lastBidAt).toEqual(0)
        }

        const buyerAddress = randomAddress();

        auc.contract.setC7Config({
            myself: auc.address,
            unixtime: defaultConfig.createdAtTimestamp + 60,
        })

        const bidResult = await makeBid(auc, buyerAddress, toNano('2'));
        expect(bidResult).toOkExecuted()

        {
            const res = await auc.getSaleData();
            expect(res.end).toEqual(false);
            expect(res.nftOwnerAddress?.equals(prevOwner)).toEqual(true);
            expect(res.lastBidAddress?.equals(buyerAddress)).toEqual(true);
            expect(res.lastBidAmount.toNumber()).toEqual(toNano('2').toNumber());
            expect(res.lastBidAt).toEqual(defaultConfig.createdAtTimestamp + 60)

            expect(res.endTimestamp).toEqual(defaultConfig.endTimestamp);
        }

        auc.contract.setC7Config({
            myself: auc.address,
            unixtime: defaultConfig.createdAtTimestamp + 100,
        })
        const buyerAddress2 = randomAddress()
        const bidResult2 = await makeBid(auc, buyerAddress2, toNano('3'));
        expect(bidResult2).toOkExecuted()
        // throw new Error(`bidResult2 gas ${bidResult2.gas_consumed}`);
        {
            const res = await auc.getSaleData();
            expect(res.end).toEqual(false);
            expect(res.nftOwnerAddress?.equals(prevOwner)).toEqual(true);
            expect(res.lastBidAddress?.equals(buyerAddress2)).toEqual(true);
            expect(res.lastBidAmount.eq(toNano('3'))).toEqual(true);
            expect(res.lastBidAt).toEqual(defaultConfig.createdAtTimestamp + 100)
        }


        auc.contract.setC7Config({
            myself: auc.address,
            unixtime: defaultConfig.endTimestamp + 60,
        })

        const finalResult = await auc.sendStopMessage(buyerAddress2);

        expect(finalResult).toOkExecuted()

        expect(finalResult.actionList).toHasMessage({
            to: defaultConfig.nftAddress, check: (cell) => isTransferPayload(cell, buyerAddress2, new BN(0))
        })
        expect(finalResult.actionList).toHasMessage({
            to: prevOwner, value: toNano('2.25')
        })

        {
            const res = await auc.getSaleData();
            expect(res.end).toEqual(true);
            expect(res.isCanceled).toEqual(false);
            expect(res.nftOwnerAddress?.equals(prevOwner)).toEqual(true);
            expect(res.lastBidAddress?.equals(buyerAddress2)).toEqual(true);


            expect(res.marketplaceAddress.equals(defaultConfig.marketplaceAddress)).toEqual(true);
            expect(res.nftAddress.equals(defaultConfig.nftAddress)).toEqual(true);
            expect(res.minStep.eq(defaultConfig.minStep)).toEqual(true);
            expect(res.marketplaceFeeAddress.equals(defaultConfig.marketplaceFeeAddress)).toEqual(true);
            expect(res.marketplaceFeeFactor.eq(defaultConfig.marketplaceFeeFactor)).toEqual(true);
            expect(res.marketplaceFeeBase.eq(defaultConfig.marketplaceFeeBase)).toEqual(true);
            expect(res.royaltyAddress.equals(defaultConfig.royaltyAddress)).toEqual(true);
            expect(res.royaltyFactor.eq(defaultConfig.royaltyFactor)).toEqual(true);
            expect(res.royaltyBase.eq(defaultConfig.royaltyBase)).toEqual(true);
            expect(res.maxBid.eq(defaultConfig.maxBid)).toEqual(true);
        }
    })

    it('return bid before start', async () => {
        const auc = await NftAuctionV2Local.createFromConfig(defaultConfig);
        const res = await auc.getSaleData();

        expect(res.end).toBe(true);

        const buyerAddress = randomAddress();

        const bidResult = await auc.contract.sendInternalMessage(new InternalMessage({
            to: auc.address,
            from: buyerAddress,
            value: toNano('2'),
            bounce: true,
            body: new CommonMessageInfo({
                body: new CellMessage(new Cell())
            })
        }));

        expect(bidResult).toOkExecuted(1005);
    })

    it('return bid after auction out of time', async () => {
        const auc = await NftAuctionV2Local.createFromConfig({
            ...defaultConfig,
            end: false,
        });
        auc.contract.setC7Config({
            myself: auc.address,
            unixtime: defaultConfig.endTimestamp - 60 * 60,
        })
        const res = await auc.getSaleData();

        expect(res.end).toBe(false);

        const buyerAddress = randomAddress();

        // legal bid
        const bidResult = await makeBid(auc, buyerAddress, toNano('2'));
        expect(bidResult).toOkExecuted()

        // check bid not return
        expect(bidResult.actionList).not.toHasMessage({to: buyerAddress, mode: 64});
        {
            const res = await auc.getSaleData();
            expect(res.end).toBe(false);
            // check bid in state
            expect(res.lastBidAmount.eq(toNano('2'))).toBe(true);
            expect(res.lastBidAddress?.equals(buyerAddress)).toBe(true);
        }

        // set time out of auction
        auc.contract.setC7Config({
            myself: auc.address,
            unixtime: defaultConfig.endTimestamp + 60 * 60,
        })

        const buyerAddress2 = randomAddress()
        const bidResult2 = await makeBid(auc, buyerAddress2, toNano('4'));

        expect(bidResult2).toOkExecuted(1005);
    });


    it('end auction with no bid', async () => {
        const cfg = {
            ...defaultConfig,
            end: false,
            nftOwnerAddress: randomAddress(),
        }
        const auc = await NftAuctionV2Local.createFromConfig(cfg);
        auc.contract.setC7Config({
            myself: auc.address,
            unixtime: cfg.endTimestamp + 60,
        });

        const res = await auc.sendStopMessage(cfg.nftOwnerAddress)

        expect(res).toOkExecuted()

        // has transfer nft back
        expect(res.actionList).toHasMessage({
            to: cfg.nftAddress, check: (cell) => isTransferPayload(cell, cfg.nftOwnerAddress)
        });


        // has NO royalties
        expect(res.actionList).not.toHasMessage({to: cfg.royaltyAddress});

        const saleData = await auc.getSaleData();

        expect(saleData.end).toBe(true);


        // check that bid returns withe end=true state
        // but not endTimestamp out
        auc.contract.setC7Config({
            myself: auc.address,
            unixtime: cfg.endTimestamp - 60,
        });
        const buyerAddress = randomAddress()
        const bidResult = await makeBid(auc, buyerAddress, toNano('2'));
        expect(bidResult).toOkExecuted(1005);
    });

    it('canceled by owner', async () => {
        const cfg = {
            ...defaultConfig,
            end: false,
            nftOwnerAddress: randomAddress(),
        }
        const auc = await NftAuctionV2Local.createFromConfig(cfg);
        auc.contract.setC7Config({
            myself: auc.address,
            unixtime: cfg.endTimestamp - 60,
        });

        const res = await auc.sendCancelMessage(cfg.nftOwnerAddress);

        expect(res).toOkExecuted()

        // has transfer back
        expect(res.actionList).toHasMessage({
            to: cfg.nftAddress, check: (cell) => isTransferPayload(cell, cfg.nftOwnerAddress)
        });


        // has NO royalties
        expect(res.actionList).not.toHasMessage({to: cfg.royaltyAddress});

        const saleData = await auc.getSaleData();
        expect(saleData.isCanceled).toEqual(true);
    });

    it('canceled by marketplace', async () => {
        const cfg = {
            ...defaultConfig,
            end: false,
            nftOwnerAddress: randomAddress(),
        }
        const auc = await NftAuctionV2Local.createFromConfig(cfg);
        auc.contract.setC7Config({
            myself: auc.address,
            unixtime: cfg.endTimestamp - 60,
        });

        const res = await auc.sendCancelMessage(cfg.marketplaceAddress);

        expect(res).toOkExecuted()

        // has transfer back
        expect(res.actionList).toHasMessage({
            to: cfg.nftAddress, check: (cell) => isTransferPayload(cell, cfg.nftOwnerAddress)
        });


        // has NO royalties
        expect(res.actionList).not.toHasMessage({to: cfg.royaltyAddress});

        const saleData = await auc.getSaleData();
        expect(saleData.isCanceled).toEqual(true);
    });


    it('stop auction with bid', async () => {
        const cfg = {
            ...defaultConfig,
            end: false,
            nftOwnerAddress: randomAddress(),
        }
        const auc = await NftAuctionV2Local.createFromConfig(cfg);
        auc.contract.setC7Config({
            myself: auc.address,
            unixtime: cfg.endTimestamp - 60,
        });

        const buyerAddress = randomAddress();

        const bidResult = await makeBid(auc, buyerAddress, toNano('2'));
        expect(bidResult).toOkExecuted()


        const stopResult = await auc.sendStopMessage(cfg.nftOwnerAddress);
        expect(stopResult).toOkExecuted()

        // has transfer nft to buyer
        expect(stopResult.actionList).toHasMessage({
            to: cfg.nftAddress, check: (cell) => isTransferPayload(cell, buyerAddress)
        });


        // has royalties
        expect(stopResult.actionList).toHasMessage({to: cfg.royaltyAddress})

        const saleData = await auc.getSaleData();
        const lb = saleData.lastBidAmount
        const maxProfit = lb.sub(lb.mul(saleData.royaltyFactor).div(saleData.royaltyBase))
            .sub(lb.mul(saleData.marketplaceFeeFactor).div(saleData.marketplaceFeeBase))
        expect(stopResult.actionList).toHasMessage({
            to: cfg.nftOwnerAddress,
            value: [maxProfit.sub(toNano('0.05')), maxProfit]
        });
    });


    it('stop auction with no bid', async () => {
        const cfg = {
            ...defaultConfig,
            end: false,
            nftOwnerAddress: randomAddress(),
        }
        const auc = await NftAuctionV2Local.createFromConfig(cfg);
        auc.contract.setC7Config({
            myself: auc.address,
            unixtime: cfg.endTimestamp - 60,
        });


        const res = await auc.sendStopMessage(cfg.nftOwnerAddress);
        expect(res).toOkExecuted()

        // has transfer nft to buyer
        expect(res.actionList).toHasMessage({
            to: cfg.nftAddress, check: (cell) => isTransferPayload(cell, cfg.nftOwnerAddress)
        });


        // has NO royalties
        expect(res.actionList).not.toHasMessage({to: cfg.royaltyAddress})
    });

    it('has anti sniping', async () => {
        const cfg = {
            ...defaultConfig,
            end: false,
            nftOwnerAddress: randomAddress(),
        }
        const auc = await NftAuctionV2Local.createFromConfig(cfg);
        auc.contract.setC7Config({
            myself: auc.address,
            unixtime: cfg.endTimestamp - 10,
        });

        const beforeBidData = await auc.getSaleData();

        const buyerAddress = randomAddress();

        const bidResult = await auc.contract.sendInternalMessage(new InternalMessage({
            to: auc.address,
            from: buyerAddress,
            value: toNano('2'),
            bounce: true,
            body: new CommonMessageInfo({
                body: new CellMessage(new Cell())
            })
        }));
        expect(bidResult).toOkExecuted()
        expect(bidResult.actionList).toHaveLength(0);
        const afterBidData = await auc.getSaleData();

        expect(afterBidData.endTimestamp).toBeGreaterThan(beforeBidData.endTimestamp);
    });


    it('return bad bids', async () => {
        const cfg = {
            ...defaultConfig,
            end: false,
            nftOwnerAddress: randomAddress(),
        }
        const auc = await NftAuctionV2Local.createFromConfig(cfg);
        auc.contract.setC7Config({
            myself: auc.address,
            unixtime: cfg.endTimestamp - 10,
        });

        const buyerAddress = randomAddress();

        const bidResult = await makeBid(auc, buyerAddress, toNano('2'));
        expect(bidResult).toOkExecuted()
        expect(bidResult.actionList).toHaveLength(0);

        const badBuyerAddress = randomAddress();
        const badBidResult = await makeBid(auc, badBuyerAddress, toNano('2.1'));
        expect(badBidResult).toOkExecuted(1000);


        const data = await auc.getSaleData();
        expect(data.lastBidAddress?.equals(buyerAddress)).toBe(true)
    });

    describe('repeat_end_auction work', () => {
        const nftOwnerAddress = randomAddress();
        let aucInstance: NftAuctionV2Local | null | Promise<NftAuctionV2Local> = null

        async function auc(): Promise<NftAuctionV2Local> {
            if (!aucInstance) {
                aucInstance = NftAuctionV2Local.createFromConfig({
                    ...defaultConfig,
                    end: false,
                    nftOwnerAddress
                })
            }
            if (aucInstance instanceof Promise) {
                return await aucInstance;
            }
            return aucInstance;
        }

        it('end = false on start', async () => {
            const saleData = await (await auc()).getSaleData();
            expect(saleData.end).toBe(false);
        })

        it('normal finished', async () => {
            (await auc()).contract.setC7Config({
                myself: (await auc()).address,
                unixtime: defaultConfig.createdAtTimestamp + 60,
            });
            // stop auction
            {
                const stoResult = await (await auc()).sendStopMessage(nftOwnerAddress);

                const saleData = await (await auc()).getSaleData();
                expect(saleData.end).toBe(true); // check that finished

                // check auction return nft to owner
                expect(stoResult.actionList).toHasMessage({
                    to: defaultConfig.nftAddress, check: (cell) => isTransferPayload(cell, nftOwnerAddress)
                });
            }
        })

        it('not reaction on repeated stop message', async () => {
            const stopResult = await (await auc()).sendStopMessage(nftOwnerAddress);
            expect(stopResult.actionList).not.toHasMessage({
                to: defaultConfig.nftAddress, check: (cell) => isTransferPayload(cell, nftOwnerAddress)
            }); // not nft transfer message


            const saleData = await (await auc()).getSaleData();
            expect(saleData.end).toBe(true); // check that finished
        })

        it('return nft by special message from marketplace', async () => {
            const msgRepeat = new Builder();
            msgRepeat.storeUint(0, 32);
            msgRepeat.storeBuffer(Buffer.from("repeat_end_auction"));

            const sendResult = await (await auc()).contract.sendInternalMessage(new InternalMessage({
                from: defaultConfig.marketplaceAddress,
                to: (await auc()).address,
                value: toNano('1.1'),
                bounce: true,
                body: new CommonMessageInfo({
                    body: new CellMessage(msgRepeat.endCell())
                })
            }));
            expect(sendResult).toOkExecuted()

            if (sendResult.logs) {
                throw sendResult.logs
            }

            // has nft transfer message
            expect(sendResult.actionList).toHasMessage({
                to: defaultConfig.nftAddress, check: (cell) => isTransferPayload(cell, nftOwnerAddress)
            });
        })
    })

    it('correct work with maxBid = 0', async () => {
        const auc = await NftAuctionV2Local.createFromConfig({
            ...defaultConfig,
            end: false,
            nftOwnerAddress: randomAddress(),
            maxBid: new BN(0),
        });

        auc.contract.setC7Config({
            myself: auc.address,
            unixtime: defaultConfig.createdAtTimestamp + 10,
        })
        const bidResult = await makeBid(auc, randomAddress(), toNano('2'));

        const saleData = await auc.getSaleData();
        // auction not finish after bid
        expect(saleData.end).toBe(false);
    })

    it('canceled by owner with bid', async () => {
        const cfg = {
            ...defaultConfig,
            end: false,
            nftOwnerAddress: randomAddress(),
        }
        const auc = await NftAuctionV2Local.createFromConfig(cfg);
        auc.contract.setC7Config({
            myself: auc.address,
            unixtime: cfg.endTimestamp - 60,
        });

        const bidAddress = randomAddress()
        await makeBid(auc, bidAddress, toNano('2'))

        const saleData = await auc.getSaleData();
        // check has bid, by checking time
        expect(saleData.lastBidAt).toEqual(cfg.endTimestamp - 60);
        expect(saleData.lastBidAmount.toNumber()).toEqual(2000000000);

        auc.contract.setC7Config({
            myself: auc.address,
            unixtime: cfg.endTimestamp - 60,
        });
        const res = await auc.sendCancelMessage(cfg.nftOwnerAddress, toNano('2'));

        expect(res).toOkExecuted()

        {
            const saleData = await auc.getSaleData();
            // check has bid, by checking time
            expect(saleData.isCanceled).toEqual(true);
        }

        // has transfer back
        expect(res.actionList).toHasMessage({
            to: cfg.nftAddress, check: (cell) => isTransferPayload(cell, cfg.nftOwnerAddress)
        })


        // has NO royalties
        expect(res.actionList).not.toHasMessage({to: cfg.royaltyAddress})

        expect(res.actionList).toHasMessage({
            to: bidAddress,
            value: [toNano('1.98'), toNano('2')],
        })
    });

    it('allow marketplace send message from auc contract', async () => {
        const auc = await NftAuctionV2Local.createFromConfig(defaultConfig);

        const transfer = new Builder();
        transfer.storeUint(0x18, 6)
        transfer.storeAddress(defaultConfig.marketplaceAddress)
        transfer.storeCoins(toNano("0.666"))
        transfer.storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        transfer.storeRef(new Builder().storeUint(555, 32).endCell())

        const transferBox = new Builder()
        transferBox.storeUint(2, 8)
        transferBox.storeRef(transfer.endCell())

        const msgResend = new Builder()
        msgResend.storeUint(0, 32);
        msgResend.storeBuffer(Buffer.from("emergency_message"));
        msgResend.storeRef(transferBox.endCell())
        const res = await auc.contract.sendInternalMessage(new InternalMessage({
            to: auc.address,
            from: defaultConfig.marketplaceAddress,
            value: toNano('0.1'),
            bounce: true,
            body: new CommonMessageInfo({
                body: new CellMessage(msgResend.endCell())
            })
        }));

        expect(res).toOkExecuted()

        expect(res.actionList).toHasMessage({
            to: defaultConfig.marketplaceAddress,
            value: toNano("0.666"),
            check: (cell) => {
                return cell.beginParse().readUint(32).toNumber() === 555
            }
        })
    });


    it("no reaction on stop from buyer until timeout", async () => {
        const auc = await NftAuctionV2Local.createFromConfig({
            ...defaultConfig,
            end: false,
            nftOwnerAddress: randomAddress(),
        });
        auc.contract.setC7Config({
            unixtime: defaultConfig.createdAtTimestamp + 1
        })

        const buyer = randomAddress();
        await makeBid(auc, buyer, toNano('2'));

        const data = await auc.getSaleData()
        expect(data.lastBidAddress?.toFriendly()).toEqual(buyer.toFriendly());

        const stopResult = await auc.sendStopMessage(buyer);
        expect(stopResult).toOkExecuted(403);

        const cancelResult = await auc.sendCancelMessage(buyer);
        expect(cancelResult).toOkExecuted(403);

        auc.contract.setC7Config({
            unixtime: defaultConfig.endTimestamp + 60
        });

        {
            const stopResult = await auc.sendStopMessage(buyer);
            expect(stopResult).toOkExecuted()
        }
    });

    it('normal work with zero royalty base and factor', async () => {
        const owner = randomAddress()
        const auc = await NftAuctionV2Local.createFromConfig({
            ...defaultConfig,
            end: false,
            nftOwnerAddress: owner,
            royaltyBase: new BN(0),
            royaltyFactor: new BN(0),
            marketplaceFeeBase: new BN(0),
            marketplaceFeeFactor: new BN(0),
        });
        auc.contract.setC7Config({unixtime: defaultConfig.createdAtTimestamp})
        const bidRes = await makeBid(auc, randomAddress(), toNano('2'));
        expect(bidRes).toOkExecuted()
        const stopRes = await auc.sendStopMessage(owner);
        expect(stopRes).toOkExecuted()
        expect(stopRes.actionList).toHasMessage({
            to: owner,
            value: toNano('2'),
        })
    });

    it('normal work with zero royalty only base', async () => {
        const owner = randomAddress()
        const auc = await NftAuctionV2Local.createFromConfig({
            ...defaultConfig,
            end: false,
            nftOwnerAddress: owner,
            // royaltyBase: new BN(0),
            royaltyFactor: new BN(0),
            // marketplaceFeeBase: new BN(0),
            marketplaceFeeFactor: new BN(0),
        });
        auc.contract.setC7Config({unixtime: defaultConfig.createdAtTimestamp})
        const bidRes = await makeBid(auc, randomAddress(), toNano('2'));
        expect(bidRes).toOkExecuted()
        const stopRes = await auc.sendStopMessage(owner);
        expect(stopRes).toOkExecuted()
        expect(stopRes.actionList).toHasMessage({
            to: owner,
            value: toNano('2'),
        })
    });
})