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
            label: '上线日期',
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
        }
    },

    // ==================== 内容信息 ====================
    content: {
        bulletPoint1: {
            enabled: false,
            label: '要点1',
            source: 'v2',
            path: 'detailPageListingResponse["bullet_point#1.value"].value',
            priority: 'optional',
            category: '内容信息'
        },
        productDescription: {
            enabled: false,
            label: '产品描述',
            source: 'v2',
            path: 'detailPageListingResponse["product_description#1.value"].value',
            priority: 'optional',
            category: '内容信息'
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
        'parentAsin', 'numberOfChildren', 'variationTheme',
        // 日期
        'launchDate',
        // 链接
        'detailPageLink', 'imageUrl'
    ],

    // 完整数据集 - 所有字段
    complete: 'all',

    // Listing优化专用
    listingOptimization: [
        'asin', 'productTitle', 'brand',
        'bulletPoint1', 'productDescription',
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
