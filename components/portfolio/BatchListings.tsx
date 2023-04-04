import {
  faChevronLeft,
  faMagnifyingGlass,
  faTrash,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  Flex,
  Text,
  Button,
  Select,
  HeaderRow,
  TableCell,
  TableRow,
  FormatCryptoCurrency,
  Input,
} from 'components/primitives'
import {
  ComponentPropsWithoutRef,
  Dispatch,
  FC,
  SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { Currency, Listings, ListModal } from '@reservoir0x/reservoir-kit-ui'
import expirationOptions from 'utils/defaultExpirationOptions'
import { ExpirationOption } from 'types/ExpirationOption'
import { UserToken } from 'pages/portfolio'
import { NAVBAR_HEIGHT } from 'components/navbar'
import CryptoCurrencyIcon from 'components/primitives/CryptoCurrencyIcon'
import { useChainCurrency } from 'hooks'
import BatchList from 'components/buttons/BatchList'
import { useMediaQuery } from 'react-responsive'
import useMarketplaceFees from 'hooks/useOpenseaFees'
import { ToastContext } from 'context/ToastContextProvider'

export type BatchListing = {
  token: UserToken
  price: string
  quantity: number
  expirationOption: ExpirationOption
  orderbook: Listings[0]['orderbook']
  orderKind: Listings[0]['orderKind']
  marketplaceFee?: number
}

type ListingCurrencies = ComponentPropsWithoutRef<
  typeof ListModal
>['currencies']

export type Marketplace = {
  name: string
  imageUrl: string
  orderbook: string
  orderKind: string
}

type Props = {
  selectedItems: UserToken[]
  setSelectedItems: Dispatch<SetStateAction<UserToken[]>>
  setShowListingPage: Dispatch<SetStateAction<boolean>>
}

const MINIMUM_AMOUNT = 0.000001

const marketplaces = [
  {
    name: 'Reservoir',
    imageUrl: 'https://api.reservoir.tools/redirect/sources/reservoir/logo/v2',
    orderbook: 'reservoir',
    orderKind: 'seaport-v1.4',
  },
  {
    name: 'OpenSea',
    imageUrl: 'https://api.reservoir.tools/redirect/sources/opensea/logo/v2',
    orderbook: 'opensea',
    orderKind: 'seaport-v1.4',
  },
]

const BatchListings: FC<Props> = ({
  selectedItems,
  setSelectedItems,
  setShowListingPage,
}) => {
  const [listings, setListings] = useState<BatchListing[]>([])

  const [selectedMarketplaces, setSelectedMarketplaces] = useState<
    Marketplace[]
  >([marketplaces[0]])

  const [globalPrice, setGlobalPrice] = useState<string>('')
  const [globalExpirationOption, setGlobalExpirationOption] =
    useState<ExpirationOption>(expirationOptions[5])

  const [totalProfit, setTotalProfit] = useState<number>(0)

  const [listButtonDisabled, setListButtonDisabled] = useState<boolean>(true)

  const isLargeDevice = useMediaQuery({ minWidth: 1400 })

  const chainCurrency = useChainCurrency()
  const defaultCurrency = {
    contract: chainCurrency.address,
    symbol: chainCurrency.symbol,
  }
  // CONFIGURABLE: Here you can configure which currencies you would like to support for batch listing
  const currencies: ListingCurrencies = [
    { ...defaultCurrency },
    {
      contract: '0xb4fbf271143f4fbf7b91a5ded31805e42b2208d6',
      decimals: 18,
      coinGeckoId: 'weth',
      symbol: 'WETH',
    },
  ]

  const [currency, setCurrency] = useState<Currency>(
    currencies && currencies[0] ? currencies[0] : defaultCurrency
  )

  const displayQuantity = useCallback(() => {
    return listings.some((listing) => listing?.token?.token?.kind === 'erc1155')
  }, [listings])

  let gridTemplateColumns = displayQuantity()
    ? isLargeDevice
      ? '1.1fr .5fr 2.6fr .8fr repeat(2, .7fr) .5fr .3fr'
      : '1.3fr .6fr 1.6fr 1fr repeat(2, .9fr) .6fr .3fr'
    : isLargeDevice
    ? '1.1fr 2.5fr 1.2fr repeat(2, .7fr) .5fr .3fr'
    : '1.3fr 1.8fr 1.2fr repeat(2, .9fr) .6fr .3fr'

  const generateListings = useCallback(() => {
    const listings = selectedItems.flatMap((item) => {
      return selectedMarketplaces.map((marketplace) => {
        const listing: BatchListing = {
          token: item,
          quantity: 1,
          price: globalPrice || '0',
          expirationOption: globalExpirationOption,
          //@ts-ignore
          orderbook: marketplace.orderbook,
          //@ts-ignore
          orderKind: marketplace.orderKind,
        }

        return listing
      })
    })

    return listings
  }, [selectedItems, selectedMarketplaces])

  useEffect(() => {
    setListings(generateListings())
  }, [selectedItems, selectedMarketplaces, generateListings])

  useEffect(() => {
    const totalProfit = listings.reduce((total, listing) => {
      const listingCreatorRoyalties =
        (Number(listing.price) *
          listing.quantity *
          (listing?.token?.token?.collection?.royaltiesBps || 0)) /
        10000

      const profit =
        Number(listing.price) * listing.quantity -
        (listing.marketplaceFee || 0) -
        listingCreatorRoyalties
      return total + profit
    }, 0)

    setTotalProfit(totalProfit)
  }, [listings, selectedMarketplaces, globalPrice])

  useEffect(() => {
    const hasInvalidPrice = listings.some(
      (listing) =>
        listing.price === undefined ||
        listing.price === '' ||
        Number(listing.price) < MINIMUM_AMOUNT
    )
    setListButtonDisabled(hasInvalidPrice)
  }, [listings])

  const removeMarketplaceListings = useCallback(
    (orderbook: string) => {
      let updatedListings = listings.filter(
        (listing) => listing.orderbook === orderbook
      )
      setListings(updatedListings)
    },
    [listings]
  )

  const addMarketplaceListings = useCallback(
    (orderbook: string, orderKind: string) => {
      setListings((prevListings) => {
        const updatedListings = [...prevListings]

        selectedItems.forEach((item) => {
          const existingListingIndex = updatedListings.findIndex(
            (listing) =>
              listing.token === item && listing.orderbook === orderbook
          )

          if (existingListingIndex === -1) {
            const newListing: BatchListing = {
              token: item,
              quantity: 1,
              price: globalPrice || '0',
              expirationOption: globalExpirationOption,
              //@ts-ignore
              orderbook: orderbook,
              //@ts-ignore
              orderKind: orderKind,
            }
            updatedListings.push(newListing)
          }
        })

        return updatedListings
      })
    },
    [selectedItems, globalPrice, globalExpirationOption]
  )

  const handleMarketplaceSelection = useCallback(
    (marketplace: Marketplace) => {
      const isSelected = selectedMarketplaces.some(
        (selected) => selected.orderbook === marketplace.orderbook
      )

      if (isSelected) {
        setSelectedMarketplaces((prevSelected) =>
          prevSelected.filter(
            (selected) => selected.orderbook !== marketplace.orderbook
          )
        )
        removeMarketplaceListings(marketplace.orderbook as string)
      } else {
        setSelectedMarketplaces((prevSelected) => [
          ...prevSelected,
          marketplace,
        ])
        addMarketplaceListings(
          marketplace.orderbook as string,
          marketplace.orderKind as string
        )
      }
    },
    [selectedMarketplaces, addMarketplaceListings, removeMarketplaceListings]
  )

  const updateListing = useCallback((updatedListing: BatchListing) => {
    setListings((prevListings) => {
      return prevListings.map((listing) => {
        if (
          listing.token === updatedListing.token &&
          listing.orderbook === updatedListing.orderbook
        ) {
          return updatedListing
        }
        return listing
      })
    })
  }, [])

  const applyFloorPrice = useCallback(() => {
    setListings((prevListings) => {
      return prevListings.map((listing) => {
        if (listing.token.token?.collection?.floorAskPrice?.amount?.native) {
          return {
            ...listing,
            price:
              listing.token.token?.collection?.floorAskPrice?.amount?.native.toString(),
          }
        }
        return listing
      })
    })
    setCurrency(defaultCurrency)
  }, [listings])

  const applyTopTraitPrice = useCallback(() => {
    setListings((prevListings) => {
      return prevListings.map((listing) => {
        if (listing.token.token?.attributes) {
          // Find the highest floor price
          let topTraitPrice = Math.max(
            ...listing.token.token.attributes.map(
              (attribute) => attribute.floorAskPrice ?? 0
            )
          )
          if (topTraitPrice && topTraitPrice > 0) {
            return {
              ...listing,
              price: topTraitPrice.toString(),
            }
          }
        }

        return listing
      })
    })
    setCurrency(defaultCurrency)
  }, [listings])

  return (
    <Flex direction="column" css={{ gap: '$5', width: '100%' }}>
      <Flex align="center" css={{ gap: 24 }}>
        <Button
          color="gray3"
          size="small"
          css={{ justifyContent: 'center', width: '44px', height: '44px' }}
          onClick={() => setShowListingPage(false)}
        >
          <FontAwesomeIcon icon={faChevronLeft} />
        </Button>
        <Text style="h4">List for Sale</Text>
      </Flex>
      <Flex
        justify="between"
        css={{ border: '1px solid $gray6', borderRadius: 8, p: 24 }}
      >
        <Flex direction="column" css={{ gap: '$3' }}>
          <Text style="h6">Select Marketplaces</Text>
          <Flex align="center" css={{ gap: '$3' }}>
            {marketplaces.map((marketplace) => {
              const isSelected = selectedMarketplaces.some(
                (selected) => selected.orderbook === marketplace.orderbook
              )

              return (
                <Flex
                  key={marketplace.name}
                  align="center"
                  css={{
                    border: isSelected
                      ? '1px solid $primary7'
                      : '1px solid $gray6',
                    borderRadius: 8,
                    gap: '$2',
                    p: '$3',
                    cursor: 'pointer',
                  }}
                  onClick={() => handleMarketplaceSelection(marketplace)}
                >
                  <img
                    src={marketplace.imageUrl}
                    alt={marketplace.name}
                    style={{ width: 32, height: 32 }}
                  />
                  <Text style="subtitle2">{marketplace.name}</Text>
                </Flex>
              )
            })}
          </Flex>
        </Flex>
        <Flex direction="column" css={{ gap: '$3' }}>
          <Text style="h6">Apply to All</Text>
          <Flex align="center" css={{ gap: '$5' }}>
            {isLargeDevice ? (
              <Flex align="center" css={{ gap: '$3' }}>
                <Button
                  color="gray3"
                  corners="pill"
                  size="large"
                  css={{ minWidth: 'max-content' }}
                  onClick={() => applyFloorPrice()}
                >
                  Floor
                </Button>
                <Button
                  color="gray3"
                  corners="pill"
                  size="large"
                  css={{ minWidth: 'max-content' }}
                  onClick={() => applyTopTraitPrice()}
                >
                  Top Trait
                </Button>
              </Flex>
            ) : null}
            <Flex align="center" css={{ gap: '$3' }}>
              <Select
                trigger={
                  <Select.Trigger
                    css={{
                      width: 115,
                    }}
                  >
                    <Select.Value asChild>
                      <Flex align="center">
                        <CryptoCurrencyIcon
                          address={currency.contract}
                          css={{ height: 18 }}
                        />
                        <Text
                          style="subtitle1"
                          color="subtle"
                          css={{ ml: '$1' }}
                        >
                          {currency.symbol}
                        </Text>
                        {currencies && currencies?.length > 1 ? (
                          <Select.DownIcon style={{ marginLeft: 6 }} />
                        ) : null}
                      </Flex>
                    </Select.Value>
                  </Select.Trigger>
                }
                value={currency.contract}
                onValueChange={(value: string) => {
                  const option = currencies?.find(
                    (option) => option.contract == value
                  )
                  if (option) {
                    setCurrency(option)
                  }
                }}
              >
                {currencies?.map((option) => (
                  <Select.Item key={option.contract} value={option.contract}>
                    <Select.ItemText>
                      <Flex align="center" css={{ gap: '$1' }}>
                        <CryptoCurrencyIcon
                          address={option.contract}
                          css={{ height: 18 }}
                        />
                        {option.symbol}
                      </Flex>
                    </Select.ItemText>
                  </Select.Item>
                ))}
              </Select>
              <Input
                placeholder="Enter a custom price"
                type="number"
                value={globalPrice}
                onChange={(e) => {
                  setGlobalPrice(e.target.value)
                }}
              />
            </Flex>
            <Flex align="center" css={{ gap: '$3' }}>
              <Select
                css={{
                  flex: 1,
                  width: 200,
                }}
                value={globalExpirationOption?.text || ''}
                onValueChange={(value: string) => {
                  const option = expirationOptions.find(
                    (option) => option.value == value
                  )
                  if (option) {
                    setGlobalExpirationOption(option)
                  }
                }}
              >
                {expirationOptions.map((option) => (
                  <Select.Item key={option.text} value={option.value}>
                    <Select.ItemText>{option.text}</Select.ItemText>
                  </Select.Item>
                ))}
              </Select>
            </Flex>
          </Flex>
        </Flex>
      </Flex>
      {listings.length > 0 ? (
        <Flex direction="column" css={{ width: '100%', pb: 37 }}>
          <TableHeading
            displayQuantity={displayQuantity()}
            gridTemplateColumns={gridTemplateColumns}
          />
          {listings.map((listing, i) => (
            <ListingsTableRow
              listing={listing}
              listings={listings}
              setListings={setListings}
              updateListing={updateListing}
              setSelectedItems={setSelectedItems}
              selectedItems={selectedItems}
              displayQuantity={displayQuantity()}
              gridTemplateColumns={gridTemplateColumns}
              isLargeDevice={isLargeDevice}
              globalExpirationOption={globalExpirationOption}
              globalPrice={globalPrice}
              currency={currency}
              defaultCurrency={defaultCurrency}
              selectedMarketplaces={selectedMarketplaces}
              key={`${listing.token.token?.collection?.id}:${listing.token.token?.tokenId}:${listing.orderbook}`}
            />
          ))}
          <Flex
            align="center"
            justify="between"
            css={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              px: '$5',
              py: '$4',
              borderTop: '1px solid $gray7',
              backgroundColor: '$neutralBg',
            }}
          >
            <Flex align="center" css={{ gap: 24, marginLeft: 'auto' }}>
              <Text style="body1">Total Profit</Text>
              <FormatCryptoCurrency
                amount={totalProfit}
                logoHeight={18}
                textStyle={'h6'}
                css={{ width: 'max-content' }}
              />
              <BatchList
                listings={listings}
                disabled={listButtonDisabled}
                currency={currency}
                selectedMarketplaces={selectedMarketplaces}
                onCloseComplete={() => {
                  setShowListingPage(false)
                  setSelectedItems([])
                  setListings([])
                }}
              />
            </Flex>
          </Flex>
        </Flex>
      ) : (
        <Flex
          direction="column"
          align="center"
          css={{ py: '$6', gap: '$4', width: '100%' }}
        >
          <Text css={{ color: '$gray11' }}>
            <FontAwesomeIcon icon={faMagnifyingGlass} size="2xl" />
          </Text>
          <Text css={{ color: '$gray11' }}>No items selected</Text>
        </Flex>
      )}
    </Flex>
  )
}

export default BatchListings

type ListingsTableRowProps = {
  listing: BatchListing
  listings: BatchListing[]
  displayQuantity: boolean
  gridTemplateColumns: string
  setListings: Dispatch<SetStateAction<BatchListing[]>>
  updateListing: (updatedListing: BatchListing) => void
  globalExpirationOption: ExpirationOption
  globalPrice: string
  currency: Currency
  defaultCurrency: Currency
  isLargeDevice: boolean
  selectedItems: UserToken[]
  setSelectedItems: Dispatch<SetStateAction<UserToken[]>>
  selectedMarketplaces: Marketplace[]
}

const ListingsTableRow: FC<ListingsTableRowProps> = ({
  listing,
  listings,
  setListings,
  updateListing,
  selectedItems,
  displayQuantity,
  gridTemplateColumns,
  isLargeDevice,
  setSelectedItems,
  globalExpirationOption,
  globalPrice,
  currency,
  defaultCurrency,
  selectedMarketplaces,
}) => {
  const [expirationOption, setExpirationOption] = useState<ExpirationOption>(
    globalExpirationOption
  )

  const [price, setPrice] = useState<string>(listing.price)

  const [quantity, setQuantity] = useState<number | undefined>(1)
  const [marketplaceFee, setMarketplaceFee] = useState<number>(0)
  const [marketplaceFeePercent, setMarketplaceFeePercent] = useState<number>(0)

  const { addToast } = useContext(ToastContext)

  const marketplace = selectedMarketplaces.find(
    (m) => m.orderbook === listing.orderbook
  )

  const handleMarketplaceFeeChange = useCallback(
    (marketplaceFee: number) => {
      setMarketplaceFee(marketplaceFee)
      const updatedListing = { ...listing, marketplaceFee: marketplaceFee }
      updateListing(updatedListing)
    },
    [listing, updateListing]
  )

  const removeListing = useCallback(
    (token: string, orderbook: string) => {
      const updatedListings = listings.filter(
        (listing) =>
          `${listing.token.token?.contract}:${listing.token.token?.tokenId}` !==
            token || listing.orderbook !== orderbook
      )

      // Update selectedItems
      const selectedItemIndex = selectedItems.findIndex(
        (item) => `${item?.token?.contract}:${item?.token?.tokenId}` === token
      )

      if (
        selectedItemIndex !== -1 &&
        !updatedListings.some(
          (listing) =>
            `${listing.token.token?.contract}:${listing.token.token?.tokenId}` ===
            token
        )
      ) {
        const updatedSelectedItems = [...selectedItems]
        updatedSelectedItems.splice(selectedItemIndex, 1)
        setSelectedItems(updatedSelectedItems)
      }

      setListings(updatedListings)
    },
    [listings]
  )

  let openseaFees = useMarketplaceFees(
    listing.orderbook == 'opensea'
      ? (listing.token.token?.collection?.id as string)
      : undefined
  )

  useEffect(() => {
    if (
      openseaFees &&
      openseaFees.fee &&
      openseaFees.fee.bps &&
      listing.orderbook == 'opensea'
    ) {
      // Remove listing and emit toast if listing not enabled
      if (!openseaFees.listingEnabled) {
        addToast?.({
          title: 'Listing not enabled',
          description: `Cannnot list ${listing.token.token?.name} on OpenSea`,
        })
        removeListing(
          `${listing.token.token?.contract}:${listing.token.token?.tokenId}`,
          listing.orderbook as string
        )
      }

      setMarketplaceFeePercent(openseaFees.fee.bps / 100 || 0)
      handleMarketplaceFeeChange(
        (openseaFees.fee.bps / 10000) * Number(price) * listing.quantity || 0
      )
    }
  }, [openseaFees, price, quantity])

  const creatorRoyalties =
    (listing?.token?.token?.collection?.royaltiesBps || 0) / 10000

  const profit =
    Number(price) * listing.quantity -
    marketplaceFee -
    creatorRoyalties * Number(price) * listing.quantity

  const topTraitPrice = useMemo(() => {
    if (!listing.token.token?.attributes) return undefined

    // Find the highest floor price
    return Math.max(
      ...listing.token.token.attributes.map(
        (attribute) => attribute.floorAskPrice ?? 0
      )
    )
  }, [])

  useEffect(() => {
    handlePriceChange(globalPrice)
  }, [globalPrice])

  useEffect(() => {
    if (listing.price != price && Number(listing.price) != 0) {
      handlePriceChange(listing.price)
    }
  }, [listing.price])

  useEffect(() => {
    handleExpirationChange(globalExpirationOption.value)
  }, [globalExpirationOption])

  const handleExpirationChange = useCallback(
    (value: string) => {
      const option = expirationOptions.find((option) => option.value === value)
      if (option) {
        setExpirationOption(option)
        const updatedListing = { ...listing, expirationOption: option }
        updateListing(updatedListing)
      }
    },
    [listing, updateListing]
  )

  const handlePriceChange = useCallback(
    (value: string) => {
      setPrice(value)
      const updatedListing = { ...listing, price: value }
      updateListing(updatedListing)
    },
    [listing, updateListing]
  )

  const handleQuantityChange = useCallback(
    (quantity: number) => {
      setQuantity(quantity)
      const updatedListing = { ...listing, quantity: quantity }
      updateListing(updatedListing)
    },
    [listing, updateListing]
  )
  return (
    <TableRow
      css={{
        gridTemplateColumns: gridTemplateColumns,
        alignItems: 'stretch',
        py: '$2',
        '&:last-child': {
          borderBottom: 'none',
        },
      }}
    >
      <TableCell>
        <Flex align="center" css={{ gap: '$3' }}>
          <img
            src={marketplace?.imageUrl}
            alt={marketplace?.name}
            style={{
              width: 32,
              height: 32,
              borderRadius: 4,
              aspectRatio: '1/1',
              visibility: marketplace?.imageUrl ? 'visible' : 'hidden',
            }}
          />
          <img
            src={listing.token.token?.image}
            style={{
              width: 48,
              height: 48,
              borderRadius: 4,
              aspectRatio: '1/1',
            }}
          />
          <Flex direction="column" css={{ minWidth: 0 }}>
            <Text style="subtitle3" color="subtle" ellipsify>
              {listing?.token?.token?.collection?.name}
            </Text>
            <Text ellipsify>#{listing?.token?.token?.tokenId}</Text>
          </Flex>
        </Flex>
      </TableCell>
      {displayQuantity ? (
        <TableCell>
          <Flex
            direction="column"
            align="center"
            css={{ gap: '$2', minWidth: 0 }}
          >
            <Input
              type="number"
              value={quantity}
              onChange={(e) => {
                const inputValue = Number(e.target.value)
                const max = Number(listing.token.ownership?.tokenCount)

                if (e.target.value === '') {
                  setQuantity(undefined)
                } else if (inputValue > max) {
                  handleQuantityChange(max)
                } else {
                  handleQuantityChange(inputValue)
                }
              }}
              onBlur={() => {
                if (quantity === undefined || quantity <= 0) {
                  handleQuantityChange(1)
                }
              }}
              css={{ maxWidth: 45 }}
              disabled={
                listing.token.token?.kind !== 'erc1155' ||
                Number(listing?.token?.ownership?.tokenCount) <= 1
              }
            />
            <Text style="subtitle3" color="subtle" ellipsify>
              {listing.token.ownership?.tokenCount} available
            </Text>
          </Flex>
        </TableCell>
      ) : null}
      <TableCell>
        <Flex align="start" css={{ gap: '$3' }}>
          {isLargeDevice ? (
            <>
              <Flex direction="column" align="center" css={{ gap: '$2' }}>
                <Button
                  color="gray3"
                  corners="pill"
                  size="large"
                  css={{ minWidth: 'max-content', minHeight: 48, py: 14 }}
                  disabled={
                    !listing.token?.token?.collection?.floorAskPrice?.amount
                      ?.native
                  }
                  onClick={() => {
                    if (
                      listing.token?.token?.collection?.floorAskPrice?.amount
                        ?.native
                    ) {
                      handlePriceChange(
                        listing.token?.token?.collection?.floorAskPrice?.amount?.native?.toString()
                      )
                    }
                  }}
                >
                  Floor
                </Button>
                {listing.token?.token?.collection?.floorAskPrice?.amount
                  ?.native ? (
                  <Text style="subtitle3" color="subtle">
                    {`${listing.token?.token?.collection?.floorAskPrice?.amount?.native} ${defaultCurrency.symbol}`}
                  </Text>
                ) : null}
              </Flex>
              <Flex direction="column" align="center" css={{ gap: '$2' }}>
                <Button
                  color="gray3"
                  corners="pill"
                  size="large"
                  css={{ minWidth: 'max-content', minHeight: 48, py: 14 }}
                  onClick={() =>
                    handlePriceChange((topTraitPrice as number).toString())
                  }
                  disabled={!topTraitPrice || topTraitPrice <= 0}
                >
                  Top Trait
                </Button>
                {topTraitPrice && topTraitPrice > 0 ? (
                  <Text style="subtitle3" color="subtle">
                    {topTraitPrice} {defaultCurrency.symbol}
                  </Text>
                ) : null}
              </Flex>
            </>
          ) : null}

          <Flex align="start" css={{ gap: '$3' }}>
            <Flex align="center" css={{ mt: 12 }}>
              <CryptoCurrencyIcon
                address={currency.contract}
                css={{ height: 18 }}
              />
              <Text style="subtitle1" color="subtle" css={{ ml: '$1' }}>
                {currency.symbol}
              </Text>
            </Flex>
            <Flex direction="column" align="center" css={{ gap: '$2' }}>
              <Input
                placeholder="Price"
                type="number"
                value={price}
                onChange={(e) => {
                  handlePriceChange(e.target.value)
                }}
                css={{ width: 100, '@bp1500': { width: 150 } }}
              />
              {price !== undefined &&
                price !== '' &&
                Number(price) !== 0 &&
                Number(price) < MINIMUM_AMOUNT && (
                  <Text style="subtitle3" color="error">
                    Must exceed {MINIMUM_AMOUNT}
                  </Text>
                )}
            </Flex>
          </Flex>
        </Flex>
      </TableCell>
      <TableCell>
        <Select
          css={{
            flex: 1,
            width: '100%',
          }}
          value={expirationOption?.text || ''}
          onValueChange={handleExpirationChange}
        >
          {expirationOptions.map((option) => (
            <Select.Item key={option.text} value={option.value}>
              <Select.ItemText>{option.text}</Select.ItemText>
            </Select.Item>
          ))}
        </Select>
      </TableCell>
      <TableCell>
        <Flex align="center" css={{ gap: '$2' }}>
          <FormatCryptoCurrency
            amount={creatorRoyalties * Number(price)}
            logoHeight={14}
            textStyle="body1"
          />
          <Text style="body1" color="subtle">
            ({creatorRoyalties * 100})%
          </Text>
        </Flex>
      </TableCell>
      <TableCell>
        <Flex align="center" css={{ gap: '$2' }}>
          <FormatCryptoCurrency
            amount={marketplaceFee}
            logoHeight={14}
            textStyle="body1"
          />
          <Text style="body1" color="subtle">
            ({marketplaceFeePercent || 0})%
          </Text>
        </Flex>
      </TableCell>
      <TableCell>
        <FormatCryptoCurrency
          amount={profit}
          logoHeight={14}
          textStyle="body1"
        />
      </TableCell>
      <TableCell css={{ marginLeft: 'auto' }}>
        <Button
          color="gray3"
          size="small"
          css={{ justifyContent: 'center', width: '44px', height: '44px' }}
          onClick={() =>
            removeListing(
              `${listing.token.token?.contract}:${listing.token.token?.tokenId}`,
              listing.orderbook as string
            )
          }
        >
          <FontAwesomeIcon icon={faTrash} />
        </Button>
      </TableCell>
    </TableRow>
  )
}

type TableHeadingProps = {
  displayQuantity: boolean
  gridTemplateColumns: string
}

const TableHeading: FC<TableHeadingProps> = ({
  displayQuantity,
  gridTemplateColumns,
}) => {
  return (
    <HeaderRow
      css={{
        display: 'none',
        '@md': { display: 'grid' },
        gridTemplateColumns: gridTemplateColumns,
        position: 'sticky',
        top: NAVBAR_HEIGHT,
        backgroundColor: '$neutralBg',
      }}
    >
      <TableCell>
        <Text style="subtitle3" color="subtle">
          Items
        </Text>
      </TableCell>
      {displayQuantity ? (
        <TableCell>
          <Text style="subtitle3" color="subtle">
            Quantity
          </Text>
        </TableCell>
      ) : null}
      <TableCell>
        <Text style="subtitle3" color="subtle">
          Price
        </Text>
      </TableCell>
      <TableCell>
        <Text style="subtitle3" color="subtle">
          Expiration
        </Text>
      </TableCell>
      <TableCell>
        <Text style="subtitle3" color="subtle">
          Creator Royalties
        </Text>
      </TableCell>
      <TableCell>
        <Text style="subtitle3" color="subtle">
          Marketplace Fee
        </Text>
      </TableCell>
      <TableCell>
        <Text style="subtitle3" color="subtle">
          Profit
        </Text>
      </TableCell>
      <TableCell css={{ marginLeft: 'auto' }}></TableCell>
    </HeaderRow>
  )
}
