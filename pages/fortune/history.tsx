import {useMemo, useState} from "react";
import {faArrowLeft} from "@fortawesome/free-solid-svg-icons";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {zeroAddress} from "viem";
import Link from "next/link";
import Image from "next/image";

import {
  Box,
  Button,
  Flex,
  FormatCryptoCurrency,
  Switch,
  Text,
  ToggleGroup,
  ToggleGroupItem
} from "components/primitives";
import {Head} from "components/Head";
import Layout from "components/Layout";
import ChainToggle from "components/common/ChainToggle";
import HistoryTable from "../../components/fortune/HistoryTable";
import {useMarketplaceChain, useMounted} from "../../hooks";
import {useMediaQuery} from "react-responsive";
import useFortuneHistory from "../../hooks/useFortuneHistory";
import {useAccount, useContractRead, useContractWrite} from "wagmi";
import FortuneAbi from "../../artifact/FortuneAbi.json";
import {FORTUNE_CHAINS} from "../../utils/chains";
import ClaimModal from "../../components/fortune/ClaimModal";
import useFortuneUserWon from "../../hooks/useFortuneUserWon";
import {Deposit, Round} from "../../hooks/useFortuneRound";
import WithdrawModal from "../../components/fortune/WithdrawModal";

const roundData: any[] = [
  { roundId: 1, winner: '0x7D3E5dD617EAF4A3d42EA550C41097086605c4aF' },
  { roundId: 2, winner: '0x7D3E5dD617EAF4A3d42EA550C41097086605c4aF' }
]

const typeToStatus: Record<string, number | undefined> = {
  "all": undefined,
  "completed": 3,
  "canceled": 4
}

const FortuneHistory = () => {
  const [type, setType] = useState<string>("all")
  const [onlyYourRound, setOnlyYourRound] = useState<boolean>(false)
  const [totalUnclaimed, setTotalUnclaimed] = useState(0n)
  const { address } = useAccount()
  const isMounted = useMounted()
  const isSmallDevice = useMediaQuery({ maxWidth: 905 }) && isMounted
  const { data: userWinningRounds } = useFortuneUserWon(address, {
    refreshInterval: 5000
  })
  const data = useFortuneHistory({
    first: 100,
    skip: 0,
    where: {
      status: typeToStatus[type],
      ...(onlyYourRound ? {
        "deposits_": {
          "depositor": address
        }
      } :  {})
    }
  })

  const rewards:  (number | number[])[][] = useMemo(() => {
    const claimList: Record<string, number[]> = {};
    let total = 0n;
    (userWinningRounds || []).forEach((r: Round) => {
      claimList[r.roundId] = r.deposits.filter(d => !d.claimed).map((d) => {
        total += ((BigInt(d.numberOfEntries) * BigInt(r.valuePerEntry)))
        return d.indice
      })

      if (!claimList[r.roundId].length) {
        delete claimList[r.roundId]
      }
    });

    setTotalUnclaimed(total);

    return Object.keys(claimList).map((k:string) => [+k, claimList[k]])
  }, [userWinningRounds])

  return (
    <Layout>
      <Head title={"History • Fortune | NFTEarth"}/>
      <Box
        css={{
          py: 24,
          px: '$3',
          height: '100%',
          pb: 160,
          '@md': {
            pb: 60,
            px: '$6',
          },
        }}
      >
        <Flex justify="between" css={{ mb: 30 }}>
          <Flex align="center" css={{ gap: 10 }}>
            <Image src="/icons/fortune.png" width={40} height={40} objectFit="contain" alt="Fortune"/>
            <Text style="h4">Fortune</Text>
          </Flex>
          <ChainToggle />
        </Flex>
        <Flex
          direction="column"
          css={{ gap: 20 }}
        >
          <Link href="/fortune">
            <Flex align="center" css={{ gap: 20 }}>
              <FontAwesomeIcon icon={faArrowLeft} width={16} height={16} color="hsl(145, 25%, 39%)" />
              <Text css={{ color: '$primary13' }}>Current Round</Text>
            </Flex>
          </Link>
          <Flex
            justify="between"
            css={{
              gap: 20,
              flexDirection: 'column',
              '@md': {
                flexDirection: 'row',
              }
            }}
          >
            <Flex
              direction="column"
              justify="end"
              css={{
                gap: 20,
                order: 2,
                '@md': {
                  order: 1
                }
              }}
            >
              <Flex
                align="center"
                css={{
                  gap: 10,
                  justifyContent: 'space-between',
                  '@md': {
                    justifyContent: 'center',
                  }
                }}
              >
                <ToggleGroup
                  type="single"
                  value={type}
                  onValueChange={(value) => {
                    if (value) {
                      setType(value)
                    }
                  }}
                  css={{ flexShrink: 0 }}
                >
                  <ToggleGroupItem value="all" css={{ p: '$2' }}>
                    <Text>All</Text>
                  </ToggleGroupItem>
                  <ToggleGroupItem value="completed" css={{ p: '$2' }}>
                    <Text>Completed</Text>
                  </ToggleGroupItem>
                  <ToggleGroupItem value="canceled" css={{ p: '$2' }}>
                    <Text>Canceled</Text>
                  </ToggleGroupItem>
                </ToggleGroup>
                <Flex
                  css={{
                    gap: 10
                  }}
                >
                  <Switch checked={onlyYourRound} onCheckedChange={setOnlyYourRound}/>
                  <Text>{isSmallDevice ? 'Yours' : 'Only your round'}</Text>
                </Flex>
              </Flex>
            </Flex>
            <Flex css={{
              gap: 20,
              order: 1,
              '@md': {
                order: 2
              },
              flexWrap: 'wrap'
            }}>
              <Flex
                justify="between"
                align="center"
                css={{
                  border: '1px solid $primary13',
                  borderRadius: 16,
                  gap: 40,
                  p: 16,
                }}
              >
                <WithdrawModal />
              </Flex>
              <Flex
                justify="between"
                align="center"
                css={{
                  border: '1px solid $primary13',
                  borderRadius: 16,
                  gap: 40,
                  p: 16,
                  order: 1,
                  '@md': {
                    order: 2
                  }
                }}
              >
                <Flex
                  direction="column"
                  css={{ gap: 10 }}
                >
                  <Text style="body3">Your Unclaimed Winnings</Text>
                  <FormatCryptoCurrency
                    amount={BigInt(totalUnclaimed || 0)}
                    address={zeroAddress}
                    logoHeight={18}
                    textStyle={'h6'}
                  />
                </Flex>
                <ClaimModal rewards={rewards} disabled={!(totalUnclaimed > BigInt(0))} />
              </Flex>
            </Flex>
          </Flex>
          <HistoryTable data={data}/>
        </Flex>
      </Box>
    </Layout>
  )
}

export default FortuneHistory;