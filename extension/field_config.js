// Amazon 数据提取字段配置文件
// 通过修改此文件，可以自定义Excel中提取的字段

const FIELD_CONFIG = {
    // ====================================
    // 字段配置说明
    // ====================================
    // enabled: true/false - 是否启用该字段
    // label: 显示在Excel中的列名
    // source: 数据来源（targets/v3/v2）
    // path: 数据路径（支持.和[]访问）
    // priority: 优先级（core/important/optional）
    // category: 字段分类
    // ====================================

    // ==================== 基础信息 ====================
    basicInfo: {
        asin: {
            enabled: true,
            label: 'ASIN',
            source: 'v3',
            path: 'asin',
            priority: 'core',
            category: '基础信息'
        },
        productTitle: {
            enabled: true,
            label: '产品标题',
            source: 'targets',
            path: '[0].targetInformation.productTitle',
            priority: 'core',
            category: '基础信息'
        },
        brand: {
            enabled: true,
            label: '品牌',
            source: 'v2',
            path: 'detailPageListingResponse["brand#1.value"].value',
            priority: 'important',
            category: '基础信息'
        },
        sku: {
            enabled: false,
            label: 'SKU',
            source: 'targets',
            path: '[0].targetInformation.sku',
            priority: 'important',
            category: '基础信息'
        },
        productType: {
            enabled: true,
            label: '产品类型',
            source: 'v3',
            path: 'productType',
            priority: 'important',
            category: '基础信息'
        },
        productTypeV2: {
            enabled: false,
            label: '产品类型(V2)',
            source: 'v2',
            path: 'detailPageListingResponse["product_type#1.value"].value',
            priority: 'optional',
            category: '基础信息'
        },
        itemName: {
            enabled: false,
            label: '商品名称',
            source: 'v2',
            path: 'detailPageListingResponse["item_name#1.value"].value',
            priority: 'important',
            category: '基础信息'
        },
        modelNumber: {
            enabled: false,
            label: '型号',
            source: 'v2',
            path: 'detailPageListingResponse["model_number#1.value"].value',
            priority: 'optional',
            category: '基础信息'
        },
        partNumber: {
            enabled: false,
            label: '件号',
            source: 'v2',
            path: 'detailPageListingResponse["part_number#1.value"].value',
            priority: 'optional',
            category: '基础信息'
        },
        marketplaceId: {
            enabled: false,
            label: '站点ID',
            source: 'targets',
            path: '[0].targetInformation.marketplaceId',
            priority: 'optional',
            category: '基础信息'
        },
        brandId: {
            enabled: false,
            label: '品牌ID',
            source: 'targets',
            path: '[0].targetInformation.brandId',
            priority: 'optional',
            category: '基础信息'
        },
        targetAsin: {
            enabled: false,
            label: '目标ASIN',
            source: 'targets',
            path: '[0].targetInformation.target',
            priority: 'optional',
            category: '基础信息'
        },
        targetType: {
            enabled: false,
            label: '目标类型',
            source: 'targets',
            path: '[0].targetInformation.targetType',
            priority: 'optional',
            category: '基础信息'
        },
        itemNameV3: {
            enabled: false,
            label: '商品名称(V3)',
            source: 'v3',
            path: 'itemName.value',
            priority: 'optional',
            category: '基础信息'
        }
    },

    // ==================== 价格信息 ====================
    pricing: {
        currentPrice: {
            enabled: true,
            label: '当前价格',
            source: 'v3',
            path: 'conditionOfferSummaries[0].landedPrice.itemPrice',
            priority: 'core',
            category: '价格信息'
        },
        listPrice: {
            enabled: true,
            label: '原价',
            source: 'v2',
            path: 'detailPageListingResponse["list_price#1.value"].value',
            priority: 'core',
            category: '价格信息'
        },
        shippingPrice: {
            enabled: false,
            label: '运费',
            source: 'v3',
            path: 'conditionOfferSummaries[0].landedPrice.shippingPrice',
            priority: 'important',
            category: '价格信息'
        }
    },

    // ==================== 销售数据 ====================
    salesData: {
        salesRank: {
            enabled: true,
            label: '销售排名',
            source: 'v3',
            path: 'salesRank',
            priority: 'core',
            category: '销售数据'
        },
        salesRankV2: {
            enabled: false,
            label: '销售排名(V2)',
            source: 'v2',
            path: 'detailPageListingResponse["sales_rank"].value',
            priority: 'optional',
            category: '销售数据'
        },
        bsrMainRank: {
            enabled: true,
            label: 'BSR大类排名',
            source: 'v3',
            path: 'detailPageSummary.salesRanks[0].rank',
            priority: 'core',
            category: '销售数据'
        },
        bsrMainCategory: {
            enabled: true,
            label: 'BSR大类名称',
            source: 'v3',
            path: 'detailPageSummary.salesRanks[0].storeContextName',
            priority: 'core',
            category: '销售数据'
        },
        bsrSubRank: {
            enabled: true,
            label: 'BSR小类排名',
            source: 'v3',
            path: 'detailPageSummary.salesRanks[1].rank',
            priority: 'core',
            category: '销售数据'
        },
        bsrSubCategory: {
            enabled: true,
            label: 'BSR小类名称',
            source: 'v3',
            path: 'detailPageSummary.salesRanks[1].storeContextName',
            priority: 'core',
            category: '销售数据'
        },
        bsrMainLink: {
            enabled: false,
            label: 'BSR大类链接',
            source: 'v3',
            path: 'detailPageSummary.salesRanks[0].bestSellersLink',
            priority: 'optional',
            category: '销售数据'
        },
        bsrSubLink: {
            enabled: false,
            label: 'BSR小类链接',
            source: 'v3',
            path: 'detailPageSummary.salesRanks[1].bestSellersLink',
            priority: 'optional',
            category: '销售数据'
        }
    },

    // ==================== 评论数据 ====================
    reviews: {
        reviewCount: {
            enabled: true,
            label: '评论数',
            source: 'v3',
            path: 'detailPageSummary.customerReviewSummary.reviewCount',
            priority: 'core',
            category: '评论数据'
        },
        reviewStars: {
            enabled: true,
            label: '评分',
            source: 'v3',
            path: 'detailPageSummary.customerReviewSummary.reviewStars',
            priority: 'core',
            category: '评论数据'
        },
        hasHalfStar: {
            enabled: false,
            label: '半星标记',
            source: 'v3',
            path: 'detailPageSummary.customerReviewSummary.hasHalfStar',
            priority: 'optional',
            category: '评论数据'
        }
    },

    // ==================== 竞争数据 ====================
    competition: {
        offerCount: {
            enabled: true,
            label: '卖家数量',
            source: 'v3',
            path: 'conditionOfferSummaries[0].offerCount',
            priority: 'core',
            category: '竞争数据'
        },
        summaryOfferCount: {
            enabled: false,
            label: '报价数量(汇总)',
            source: 'v3',
            path: 'detailPageSummary.offerSummaries[0].numOffers',
            priority: 'optional',
            category: '竞争数据'
        },
        summaryOfferType: {
            enabled: false,
            label: '报价类型(汇总)',
            source: 'v3',
            path: 'detailPageSummary.offerSummaries[0].offerType',
            priority: 'optional',
            category: '竞争数据'
        },
        summaryLowestOfferPrice: {
            enabled: false,
            label: '最低报价(汇总)',
            source: 'v3',
            path: 'detailPageSummary.offerSummaries[0].lowestOfferPrice',
            priority: 'optional',
            category: '竞争数据'
        },
        offerListingLink: {
            enabled: false,
            label: '报价列表链接',
            source: 'v3',
            path: 'detailPageSummary.offerSummaries[0].offerListingLink',
            priority: 'optional',
            category: '竞争数据'
        }
    },

    // ==================== 流量数据 ====================
    traffic: {
        glanceViewCount: {
            enabled: true,
            label: '浏览量',
            source: 'targets',
            path: '[0].targetInformation.glanceViewCount',
            priority: 'important',
            category: '流量数据'
        },
        searchImpressionCount: {
            enabled: false,
            label: '搜索展示',
            source: 'targets',
            path: '[0].targetInformation.searchImpressionCount',
            priority: 'important',
            category: '流量数据'
        }
    },

    // ==================== 广告状态 ====================
    advertising: {
        targetStatus: {
            enabled: false,
            label: '广告状态',
            source: 'targets',
            path: '[0].targetInformation.targetEligibility[0].targetStatus',
            priority: 'important',
            category: '广告状态'
        },
        targetStatusReason: {
            enabled: false,
            label: '状态原因',
            source: 'targets',
            path: '[0].targetInformation.targetEligibility[0].targetStatusReason',
            priority: 'optional',
            category: '广告状态'
        },
        targetStatusRaw: {
            enabled: false,
            label: '状态(原始)',
            source: 'targets',
            path: '[0].targetInformation.targetStatus',
            priority: 'optional',
            category: '广告状态'
        },
        targetStatusReasonRaw: {
            enabled: false,
            label: '状态原因(原始)',
            source: 'targets',
            path: '[0].targetInformation.targetStatusReason',
            priority: 'optional',
            category: '广告状态'
        },
        targetStatusMetadataRaw: {
            enabled: false,
            label: '状态元数据(原始)',
            source: 'targets',
            path: '[0].targetInformation.targetStatusMetadata',
            priority: 'optional',
            category: '广告状态'
        }
    },

    // ==================== 产品属性 ====================
    attributes: {
        color: {
            enabled: true,
            label: '颜色',
            source: 'v2',
            path: 'detailPageListingResponse["color#1.value"].value',
            priority: 'core',
            category: '产品属性'
        },
        size: {
            enabled: true,
            label: '尺码',
            source: 'v2',
            path: 'detailPageListingResponse["apparel_size#1.size"].value',
            priority: 'core',
            category: '产品属性'
        },
        sizeTo: {
            enabled: false,
            label: '尺码范围',
            source: 'v2',
            path: 'detailPageListingResponse["apparel_size#1.size_to"].value',
            priority: 'important',
            category: '产品属性'
        },
        bodyType: {
            enabled: false,
            label: '体型',
            source: 'v2',
            path: 'detailPageListingResponse["apparel_size#1.body_type"].value',
            priority: 'optional',
            category: '产品属性'
        },
        heightType: {
            enabled: false,
            label: '身高类型',
            source: 'v2',
            path: 'detailPageListingResponse["apparel_size#1.height_type"].value',
            priority: 'optional',
            category: '产品属性'
        },
        sizeClass: {
            enabled: false,
            label: '尺码等级',
            source: 'v2',
            path: 'detailPageListingResponse["apparel_size#1.size_class"].value',
            priority: 'optional',
            category: '产品属性'
        },
        sizeSystem: {
            enabled: false,
            label: '尺码体系',
            source: 'v2',
            path: 'detailPageListingResponse["apparel_size#1.size_system"].value',
            priority: 'optional',
            category: '产品属性'
        },
        material: {
            enabled: true,
            label: '材质',
            source: 'v2',
            path: 'detailPageListingResponse["material#1.value"].value',
            priority: 'important',
            category: '产品属性'
        },
        fabricType: {
            enabled: false,
            label: '面料类型',
            source: 'v2',
            path: 'detailPageListingResponse["fabric_type#1.value"].value',
            priority: 'optional',
            category: '产品属性'
        },
        pattern: {
            enabled: false,
            label: '图案',
            source: 'v2',
            path: 'detailPageListingResponse["pattern#1.value"].value',
            priority: 'optional',
            category: '产品属性'
        },
        style: {
            enabled: false,
            label: '风格',
            source: 'v2',
            path: 'detailPageListingResponse["style#1.value"].value',
            priority: 'optional',
            category: '产品属性'
        },
        colorMap: {
            enabled: false,
            label: '颜色标准值',
            source: 'v2',
            path: 'detailPageListingResponse["color#1.standardized_values#1"].value',
            priority: 'optional',
            category: '产品属性'
        },
        heightMap: {
            enabled: false,
            label: '袜高类型',
            source: 'v2',
            path: 'detailPageListingResponse["height_map#1.value"].value',
            priority: 'optional',
            category: '产品属性'
        },
        fabricStretch: {
            enabled: false,
            label: '面料弹性',
            source: 'v2',
            path: 'detailPageListingResponse["apparel_fabric_stretch#1.value"].value',
            priority: 'optional',
            category: '产品属性'
        },
        fabricWeightClass: {
            enabled: false,
            label: '面料厚度',
            source: 'v2',
            path: 'detailPageListingResponse["apparel_fabric_weight_class#1.value"].value',
            priority: 'optional',
            category: '产品属性'
        },
        fitType: {
            enabled: false,
            label: '版型',
            source: 'v2',
            path: 'detailPageListingResponse["fit_type#1.value"].value',
            priority: 'optional',
            category: '产品属性'
        },
        toeStyle: {
            enabled: false,
            label: '脚趾样式',
            source: 'v2',
            path: 'detailPageListingResponse["toe_style#1.value"].value',
            priority: 'optional',
            category: '产品属性'
        },
        specialSizeType: {
            enabled: false,
            label: '特殊尺码',
            source: 'v2',
            path: 'detailPageListingResponse["special_size_type#1.value"].value',
            priority: 'optional',
            category: '产品属性'
        },
        fitToSizeSentiment: {
            enabled: false,
            label: '尺码反馈',
            source: 'v2',
            path: 'detailPageListingResponse["fit_to_size_sentiment#1.value"].value',
            priority: 'optional',
            category: '产品属性'
        }
    },

    // ==================== 包装信息 ====================
    packaging: {
        packageLength: {
            enabled: true,
            label: '包装长度(cm)',
            source: 'v2',
            path: 'detailPageListingResponse["item_package_dimensions#1.length.value"].value',
            priority: 'important',
            category: '包装信息'
        },
        packageWidth: {
            enabled: true,
            label: '包装宽度(cm)',
            source: 'v2',
            path: 'detailPageListingResponse["item_package_dimensions#1.width.value"].value',
            priority: 'important',
            category: '包装信息'
        },
        packageHeight: {
            enabled: true,
            label: '包装高度(cm)',
            source: 'v2',
            path: 'detailPageListingResponse["item_package_dimensions#1.height.value"].value',
            priority: 'important',
            category: '包装信息'
        },
        packageWeight: {
            enabled: true,
            label: '包装重量(kg)',
            source: 'v2',
            path: 'detailPageListingResponse["item_package_weight#1.value"].value',
            priority: 'core',
            category: '包装信息'
        },
        packageLengthUnit: {
            enabled: false,
            label: '包装长度单位',
            source: 'v2',
            path: 'detailPageListingResponse["item_package_dimensions#1.length.unit"].value',
            priority: 'optional',
            category: '包装信息'
        },
        packageWidthUnit: {
            enabled: false,
            label: '包装宽度单位',
            source: 'v2',
            path: 'detailPageListingResponse["item_package_dimensions#1.width.unit"].value',
            priority: 'optional',
            category: '包装信息'
        },
        packageHeightUnit: {
            enabled: false,
            label: '包装高度单位',
            source: 'v2',
            path: 'detailPageListingResponse["item_package_dimensions#1.height.unit"].value',
            priority: 'optional',
            category: '包装信息'
        },
        packageWeightUnit: {
            enabled: false,
            label: '包装重量单位',
            source: 'v2',
            path: 'detailPageListingResponse["item_package_weight#1.unit"].value',
            priority: 'optional',
            category: '包装信息'
        },
        unitCount: {
            enabled: true,
            label: '数量',
            source: 'v2',
            path: 'detailPageListingResponse["unit_count#1.value"].value',
            priority: 'important',
            category: '包装信息'
        },
        unitType: {
            enabled: false,
            label: '单位类型',
            source: 'v2',
            path: 'detailPageListingResponse["unit_count#1.type.value"].value',
            priority: 'optional',
            category: '包装信息'
        }
    },

    // ==================== 合规信息 ====================
    compliance: {
        dangerousGoods: {
            enabled: true,
            label: '危险品声明',
            source: 'v2',
            path: 'detailPageListingResponse["supplier_declared_dg_hz_regulation#1.value"].value',
            priority: 'important',
            category: '合规信息'
        },
        upc: {
            enabled: true,
            label: 'UPC',
            source: 'v2',
            path: 'detailPageListingResponse["externally_assigned_product_identifier#1.value"].value',
            priority: 'important',
            category: '合规信息'
        },
        importDesignation: {
            enabled: false,
            label: '进口标识',
            source: 'v2',
            path: 'detailPageListingResponse["import_designation#1.value"].value',
            priority: 'optional',
            category: '合规信息'
        }
    },

    // ==================== 变体信息 ====================
    variants: {
        parentAsin: {
            enabled: true,
            label: '父ASIN',
            source: 'targets',
            path: '[0].targetInformation.parent',
            priority: 'important',
            category: '变体信息'
        },
        numberOfChildren: {
            enabled: true,
            label: '子变体数量',
            source: 'targets',
            path: '[0].targetInformation.numberOfChildren',
            priority: 'core',
            category: '变体信息'
        },
        childrenAsins: {
            enabled: true,
            label: '子体ASIN列表',
            source: 'targets',
            path: '[0].targetInformation.children',
            priority: 'optional',
            category: '变体信息'
        },
        skus: {
            enabled: false,
            label: 'SKU列表',
            source: 'targets',
            path: '[0].targetInformation.skus',
            priority: 'optional',
            category: '变体信息'
        },
        userSelectedId: {
            enabled: false,
            label: '用户选择ID',
            source: 'targets',
            path: '[0].targetInformation.userSelectedId',
            priority: 'optional',
            category: '变体信息'
        },
        variationTheme: {
            enabled: true,
            label: '变体主题',
            source: 'v2',
            path: 'detailPageListingResponse["variation_theme#1.name"].value',
            priority: 'important',
            category: '变体信息'
        }
    },

    // ==================== 日期信息 ====================
    dates: {
        launchDate: {
            enabled: true,
            label: 'Product Site Date',
            source: 'v2',
            path: 'detailPageListingResponse["product_site_launch_date#1.value"].value',
            priority: 'important',
            category: '日期信息'
        }
    },

    // ==================== 链接与素材 ====================
    links: {
        detailPageLink: {
            enabled: true,
            label: '详情页链接',
            source: 'v3',
            path: 'detailPageSummary.detailPageLink',
            priority: 'core',
            category: '链接素材'
        },
        imageUrl: {
            enabled: true,
            label: '主图URL',
            source: 'v2',
            path: 'detailPageListingResponse.detail_page_primary_image_url.value',
            priority: 'core',
            category: '链接素材'
        },
        imageUrlV3: {
            enabled: false,
            label: '主图URL(V3)',
            source: 'v3',
            path: 'imageUrl',
            priority: 'optional',
            category: '链接素材'
        },
        imageUrlTargets: {
            enabled: false,
            label: '主图URL(Targets)',
            source: 'targets',
            path: '[0].targetInformation.imageURL',
            priority: 'optional',
            category: '链接素材'
        }
    },

    // ==================== 内容信息 ====================
    content: {
        bulletPoint1: {
            enabled: false,
            label: '要点1',
            source: 'targets',
            path: '[0].targetInformation.bulletPoints[0]',
            priority: 'optional',
            category: '内容信息'
        },
        bulletPoint2: {
            enabled: false,
            label: '要点2',
            source: 'targets',
            path: '[0].targetInformation.bulletPoints[1]',
            priority: 'optional',
            category: '内容信息'
        },
        bulletPoint3: {
            enabled: false,
            label: '要点3',
            source: 'targets',
            path: '[0].targetInformation.bulletPoints[2]',
            priority: 'optional',
            category: '内容信息'
        },
        bulletPoint4: {
            enabled: false,
            label: '要点4',
            source: 'targets',
            path: '[0].targetInformation.bulletPoints[3]',
            priority: 'optional',
            category: '内容信息'
        },
        bulletPoint5: {
            enabled: false,
            label: '要点5',
            source: 'targets',
            path: '[0].targetInformation.bulletPoints[4]',
            priority: 'optional',
            category: '内容信息'
        },
        productDescription: {
            enabled: true,
            label: '产品描述',
            source: 'targets',
            path: '[0].targetInformation.productDescription',
            priority: 'optional',
            category: '内容信息'
        }
    },

    // ==================== 原始数据 ====================
    rawData: {
        reconciledProductAttributesRaw: {
            enabled: false,
            label: '属性原始数据(V3)',
            source: 'v3',
            path: 'reconciledProductAttributes',
            priority: 'optional',
            category: '原始数据'
        },
        reconciledListingRaw: {
            enabled: false,
            label: 'Listing原始数据(V3)',
            source: 'v3',
            path: 'reconciledListing',
            priority: 'optional',
            category: '原始数据'
        },
        debugRaw: {
            enabled: false,
            label: '调试字段(V3)',
            source: 'v3',
            path: 'debug',
            priority: 'optional',
            category: '原始数据'
        }
    },

    // ==================== 其他属性 ====================
    other: {
        department: {
            enabled: false,
            label: '部门',
            source: 'v2',
            path: 'detailPageListingResponse["department#1.value"].value',
            priority: 'optional',
            category: '其他属性'
        },
        targetGender: {
            enabled: false,
            label: '目标性别',
            source: 'v2',
            path: 'detailPageListingResponse["target_gender#1.value"].value',
            priority: 'optional',
            category: '其他属性'
        },
        ageRange: {
            enabled: false,
            label: '年龄范围',
            source: 'v2',
            path: 'detailPageListingResponse["age_range_description#1.value"].value',
            priority: 'optional',
            category: '其他属性'
        },
        specialFeature: {
            enabled: false,
            label: '特殊功能',
            source: 'v2',
            path: 'detailPageListingResponse["special_feature#1.value"].value',
            priority: 'optional',
            category: '其他属性'
        },
        careInstructions: {
            enabled: false,
            label: '保养说明',
            source: 'v2',
            path: 'detailPageListingResponse["care_instructions#1.value"].value',
            priority: 'optional',
            category: '其他属性'
        },
        sportType: {
            enabled: false,
            label: '运动类型',
            source: 'v2',
            path: 'detailPageListingResponse["sport_type#1.value"].value',
            priority: 'optional',
            category: '其他属性'
        },
        itemTypeKeyword: {
            enabled: false,
            label: '商品关键词',
            source: 'v2',
            path: 'detailPageListingResponse["item_type_keyword#1.value"].value',
            priority: 'optional',
            category: '其他属性'
        },
        lifestyle: {
            enabled: false,
            label: '生活方式',
            source: 'v2',
            path: 'detailPageListingResponse["lifestyle#1.value"].value',
            priority: 'optional',
            category: '其他属性'
        },
        skipOffer: {
            enabled: false,
            label: '跳过Offer',
            source: 'v2',
            path: 'detailPageListingResponse["skip_offer#1.value"].value',
            priority: 'optional',
            category: '其他属性'
        }
    }
};

// ====================================
// 预设配置方案
// ====================================

const PRESET_CONFIGS = {
    // 最小核心集 - 15个字段
    minimal: [
        'asin', 'productTitle', 'currentPrice', 'listPrice',
        'bsrMainRank', 'bsrSubRank', 'reviewCount', 'reviewStars',
        'offerCount', 'color', 'size', 'packageWeight',
        'numberOfChildren', 'imageUrl', 'detailPageLink'
    ],

    // 标准运营集 - 35个字段
    standard: [
        // 基础信息
        'asin', 'productTitle', 'brand', 'sku', 'productType',
        // 价格
        'currentPrice', 'listPrice', 'shippingPrice',
        // 销售
        'salesRank', 'bsrMainRank', 'bsrMainCategory', 'bsrSubRank', 'bsrSubCategory',
        // 评论
        'reviewCount', 'reviewStars',
        // 竞争
        'offerCount',
        // 流量
        'glanceViewCount', 'searchImpressionCount',
        // 属性
        'color', 'size', 'material',
        // 包装
        'packageLength', 'packageWidth', 'packageHeight', 'packageWeight', 'unitCount',
        // 合规
        'dangerousGoods', 'upc',
        // 变体
        'parentAsin', 'childrenAsins', 'numberOfChildren', 'variationTheme',
        // 日期
        'launchDate',
        // 内容
        'productDescription',
        // 链接
        'detailPageLink', 'imageUrl'
    ],

    // 完整数据集 - 所有字段
    complete: 'all',

    // Listing优化专用
    listingOptimization: [
        'asin', 'productTitle', 'brand',
        'bulletPoint1', 'bulletPoint2', 'bulletPoint3', 'bulletPoint4', 'bulletPoint5',
        'productDescription',
        'imageUrl', 'detailPageLink',
        'glanceViewCount', 'reviewCount', 'reviewStars',
        'color', 'size', 'material'
    ],

    // 竞品分析专用
    competitorAnalysis: [
        'asin', 'productTitle', 'brand',
        'currentPrice', 'listPrice',
        'salesRank', 'bsrMainRank', 'bsrSubRank',
        'reviewCount', 'reviewStars',
        'offerCount', 'glanceViewCount',
        'numberOfChildren', 'launchDate',
        'detailPageLink'
    ],

    // FBA费用计算专用
    fbaCalculation: [
        'asin', 'productTitle',
        'packageLength', 'packageWidth', 'packageHeight',
        'packageWeight', 'dangerousGoods',
        'unitCount', 'currentPrice'
    ],

    // 选品研究专用
    productResearch: [
        'asin', 'productTitle', 'brand',
        'currentPrice', 'listPrice',
        'salesRank', 'bsrMainRank', 'bsrSubRank',
        'reviewCount', 'reviewStars',
        'offerCount', 'numberOfChildren',
        'launchDate', 'color', 'size', 'material'
    ]
};

// ====================================
// 使用说明
// ====================================

/*
使用方法：

1. 启用/禁用字段：
   将 enabled 设置为 true 或 false

2. 自定义列名：
   修改 label 的值

3. 应用预设配置：
   在脚本中调用：
   applyPreset('minimal')     // 最小核心集
   applyPreset('standard')    // 标准运营集
   applyPreset('complete')    // 完整数据集
   applyPreset('listingOptimization')  // Listing优化

4. 按优先级筛选：
   getFieldsByPriority('core')       // 只提取核心字段
   getFieldsByPriority('important')  // 核心+重要字段
   getFieldsByPriority('optional')   // 所有字段

5. 按分类筛选：
   getFieldsByCategory('价格信息')  // 只提取价格相关字段
   getFieldsByCategory('销售数据')  // 只提取销售相关字段

示例代码见 amazon_data_extractor.html
*/

// ====================================
// 导出配置
// ====================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FIELD_CONFIG, PRESET_CONFIGS };
}

if (typeof window !== 'undefined') {
    window.FIELD_CONFIG = FIELD_CONFIG;
    window.PRESET_CONFIGS = PRESET_CONFIGS;
}
