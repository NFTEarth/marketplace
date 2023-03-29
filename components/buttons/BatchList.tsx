import { faCheckCircle } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import {
  Currency,
  Listings,
  Marketplace,
  useReservoirClient,
} from '@reservoir0x/reservoir-kit-ui'
import { Execute } from '@reservoir0x/reservoir-sdk'
import LoadingSpinner from 'components/common/LoadingSpinner'
import { Modal } from 'components/common/Modal'
import TransactionProgress from 'components/common/TransactionProgress'
import { BatchListing } from 'components/portfolio/BatchListings'
import ProgressBar from 'components/portfolio/ProgressBar'
import { Box, Button, Flex, Text } from 'components/primitives'
import ErrorWell from 'components/primitives/ErrorWell'
import dayjs from 'dayjs'
import { constants } from 'ethers'
import { parseUnits } from 'ethers/lib/utils.js'
import { useMarketplaceChain } from 'hooks'
import { UserToken } from 'pages/portfolio'
import { FC, useCallback, useEffect, useState } from 'react'
import { useNetwork, useSigner, useSwitchNetwork } from 'wagmi'

enum BatchListStep {
  Approving,
  Complete,
}

type BatchListingData = {
  listing: Listings[0]
  token: UserToken
}

type BatchListModalStepData = {
  totalSteps: number
  stepProgress: number
  currentStep: Execute['steps'][0]
  listings: BatchListingData[]
}

type Props = {
  listings: BatchListing[]
  disabled: boolean
  currency: Currency
  selectedMarketplaces: Marketplace[]
  onCloseComplete?: () => void
}

const BatchList: FC<Props> = ({
  listings,
  disabled,
  currency,
  selectedMarketplaces,
  onCloseComplete,
}) => {
  const [open, setOpen] = useState(false)
  const { data: signer } = useSigner()
  const { openConnectModal } = useConnectModal()
  const { chain: activeChain } = useNetwork()
  const marketplaceChain = useMarketplaceChain()
  const { switchNetworkAsync } = useSwitchNetwork({
    chainId: marketplaceChain.id,
  })
  const isInTheWrongNetwork = Boolean(
    signer && activeChain?.id !== marketplaceChain.id
  )
  const client = useReservoirClient()
  const [batchListStep, setBatchListStep] = useState<BatchListStep>(
    BatchListStep.Approving
  )
  const [stepData, setStepData] = useState<BatchListModalStepData | null>(null)
  const [transactionError, setTransactionError] = useState<Error | null>()
  const [stepTitle, setStepTitle] = useState('')
  const [uniqueMarketplaces, setUniqueMarketplaces] = useState<Marketplace[]>(
    []
  )

  const getUniqueMarketplaces = useCallback(
    (listings: BatchListModalStepData['listings']): Marketplace[] => {
      const marketplaces: Marketplace[] = []
      listings.forEach((listing) => {
        const marketplace = selectedMarketplaces.find(
          (m) => m.orderbook === listing.listing.orderbook
        )
        if (marketplace && !marketplaces.includes(marketplace)) {
          marketplaces.push(marketplace)
        }
      })
      return marketplaces
    },
    [listings]
  )

  console.log(stepData)

  useEffect(() => {
    if (stepData) {
      const orderKind = stepData.listings[0].listing.orderKind || 'exchange'
      const marketplaces = getUniqueMarketplaces(stepData.listings)
      const marketplaceNames = marketplaces
        .map((marketplace) => marketplace.name)
        .join(' and ')
      setUniqueMarketplaces(marketplaces)

      switch (stepData.currentStep.kind) {
        case 'transaction': {
          setStepTitle(
            `Approve ${
              orderKind?.[0].toUpperCase() + orderKind?.slice(1)
            } to access item\nin your wallet`
          )
          break
        }
        case 'signature': {
          setStepTitle(
            `Confirm listings on ${marketplaceNames}\nin your wallet`
          )
          break
        }
      }
    }
  }, [stepData])

  const listTokens = useCallback(() => {
    if (!signer) {
      const error = new Error('Missing a signer')
      setTransactionError(error)
      throw error
    }

    if (!client) {
      const error = new Error('ReservoirClient was not initialized')
      setTransactionError(error)
      throw error
    }

    setTransactionError(null)

    const batchListingData: BatchListingData[] = []

    listings.forEach((listing) => {
      let expirationTime: string | null = null

      if (
        listing.expirationOption &&
        listing.expirationOption.relativeTime &&
        listing.expirationOption.relativeTimeUnit
      ) {
        expirationTime = dayjs()
          .add(
            listing.expirationOption.relativeTime,
            listing.expirationOption.relativeTimeUnit
          )
          .unix()
          .toString()
      }

      const token = `${listing.token.token?.contract}:${listing.token.token?.tokenId}`

      const convertedListing: Listings[0] = {
        token: token,
        weiPrice: parseUnits(`${+listing.price}`, currency.decimals)
          .mul(listing.quantity)
          .toString(),
        orderbook: listing.orderbook,
        orderKind: listing.orderKind,
        quantity: listing.quantity,
        // automatedRoyalties: true // TODO: how do we want to handle royalties?
      }

      if (expirationTime) {
        convertedListing.expirationTime = expirationTime
      }

      if (currency && currency.contract != constants.AddressZero) {
        convertedListing.currency = currency.contract
      }

      batchListingData.push({
        listing: convertedListing,
        token: listing.token,
      })
    })

    setBatchListStep(BatchListStep.Approving)

    client.actions
      .listToken({
        listings: batchListingData.map((data) => data.listing),
        signer,
        onProgress: (steps: Execute['steps']) => {
          const executableSteps = steps.filter(
            (step) => step.items && step.items.length > 0
          )

          let stepCount = executableSteps.length
          let incompleteStepItemIndex: number | null = null
          let incompleteStepIndex: number | null = null

          executableSteps.find((step, i) => {
            if (!step.items) {
              return false
            }

            incompleteStepItemIndex = step.items.findIndex(
              (item) => item.status == 'incomplete'
            )
            if (incompleteStepItemIndex !== -1) {
              incompleteStepIndex = i
              return true
            }
          })

          if (
            incompleteStepIndex === null ||
            incompleteStepItemIndex === null
          ) {
            const currentStep = executableSteps[executableSteps.length - 1]
            const currentStepItem = currentStep.items
              ? currentStep.items[currentStep.items.length]
              : null
            setBatchListStep(BatchListStep.Complete)
            const listings =
              currentStepItem && currentStepItem.orderIndexes !== undefined
                ? batchListingData.filter((_, i) =>
                    currentStepItem.orderIndexes?.includes(i)
                  )
                : [batchListingData[batchListingData.length - 1]]
            setStepData({
              totalSteps: stepCount,
              stepProgress: stepCount,
              currentStep,
              listings: listings,
            })
          } else {
            const currentStep = executableSteps[incompleteStepIndex]
            const currentStepItem = currentStep.items
              ? currentStep.items[incompleteStepItemIndex]
              : null
            const listings =
              currentStepItem && currentStepItem.orderIndexes !== undefined
                ? batchListingData.filter((_, i) =>
                    currentStepItem.orderIndexes?.includes(i)
                  )
                : [batchListingData[batchListingData.length - 1]]

            setStepData({
              totalSteps: stepCount,
              stepProgress: incompleteStepIndex,
              currentStep: executableSteps[incompleteStepIndex],
              listings: listings,
            })
          }
        },
      })
      .catch((e: any) => {
        const error = e as Error
        const transactionError = new Error(error?.message || '', {
          cause: error,
        })
        setTransactionError(transactionError)
      })
  }, [client, listings, signer])

  const trigger = (
    <Button disabled={disabled} onClick={listTokens}>
      List
    </Button>
  )
  if (isInTheWrongNetwork) {
    return (
      <Button
        disabled={disabled}
        onClick={async () => {
          if (isInTheWrongNetwork && switchNetworkAsync) {
            const chain = await switchNetworkAsync(marketplaceChain.id)
            if (chain.id !== marketplaceChain.id) {
              return false
            }
          }

          if (!signer) {
            openConnectModal?.()
          }
        }}
      >
        List
      </Button>
    )
  }
  return (
    <Modal
      title="Complete Listings"
      trigger={trigger}
      open={open}
      onOpenChange={(open) => {
        if (
          !open &&
          onCloseComplete &&
          batchListStep === BatchListStep.Complete
        ) {
          onCloseComplete()
        }
        setOpen(open)
      }}
    >
      {batchListStep === BatchListStep.Approving && (
        <Flex
          direction="column"
          css={{ flex: 1, textAlign: 'center', p: '$4', gap: '$4' }}
        >
          <ProgressBar value={1} max={2} />
          {transactionError && <ErrorWell message={transactionError.message} />}
          {!stepData && !transactionError && (
            <Flex
              css={{ height: '100%', py: '$6' }}
              justify="center"
              align="center"
            >
              <LoadingSpinner />
            </Flex>
          )}
          {stepData && (
            <Flex direction="column" align="center">
              <Text
                css={{
                  textAlign: 'center',
                  my: 28,
                  maxWidth: 400,
                }}
                style="subtitle1"
              >
                {stepTitle}
              </Text>
              <TransactionProgress
                justify="center"
                fromImgs={stepData.listings.map(
                  (listing) => listing.token.token?.image as string
                )}
                toImgs={uniqueMarketplaces.map((marketplace) => {
                  return marketplace?.imageUrl || ''
                })}
              />
              <Text
                css={{
                  textAlign: 'center',
                  mt: 24,
                  maxWidth: 395,
                  mx: 'auto',
                  mb: '$4',
                }}
                style="body2"
                color="subtle"
              >
                {stepData?.currentStep.description}
              </Text>
            </Flex>
          )}

          {!transactionError ? (
            <Button
              css={{ width: '100%', justifyContent: 'center' }}
              disabled={true}
            >
              Waiting for Approval...
            </Button>
          ) : (
            <Button
              css={{ width: '100%', justifyContent: 'center' }}
              onClick={() => setOpen(false)}
            >
              Close
            </Button>
          )}
        </Flex>
      )}
      {batchListStep === BatchListStep.Complete && (
        <Flex
          direction="column"
          align="center"
          justify="center"
          css={{ flex: 1, textAlign: 'center', p: '$4' }}
        >
          <Flex direction="column" css={{ my: 50 }}>
            <Box css={{ color: '$green10', mb: 24 }}>
              <FontAwesomeIcon icon={faCheckCircle} size="2x" />
            </Box>
            <Text style="h5">Your items have been listed!</Text>
          </Flex>
          <Button
            css={{ width: '100%', justifyContent: 'center' }}
            onClick={() => {
              setOpen(false)
              onCloseComplete?.()
            }}
          >
            Close
          </Button>
        </Flex>
      )}
    </Modal>
  )
}

export default BatchList
