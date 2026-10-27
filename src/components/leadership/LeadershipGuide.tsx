const classifications = [
  {
    name: 'Established · 已確立領導股',
    meaning: '年度排名強勢，且技術結構完整，代表已具備市場領導地位。',
    rule: 'Annual RS ≥90，且 Trend Template 九項條件全部通過。Utility RS 未啟用或偏低，都不會直接取消此分類。',
  },
  {
    name: 'Emerging · 新興領導股',
    meaning: '年度排名尚未到最頂端，但近期排名明顯提升，觀察它是否正在成為新領導股。',
    rule: '70 ≤ Annual RS <90，且 Δ RS 20D ≥+10；Utility 啟用期間，還需要 Utility RS ≥90。缺少 20 日歷史時無法判定。',
  },
  {
    name: 'Resilient · 修正期韌性股',
    meaning: '市場離開高點後仍展現相對強勢，股價靠近自身高點，且守住長期均線。',
    rule: 'Utility 啟用、Utility RS ≥90、價格不低於自身 200 日高點的 90%，且價格高於 MA200。',
  },
  {
    name: 'Fading · 領導力減弱股',
    meaning: '年度排名仍高，但近期排名已明顯下滑，觀察原本的領導地位是否正在減弱。',
    rule: 'Annual RS ≥85，且 Δ RS 20D ≤−10。目前不額外要求 Utility RS 偏低。',
  },
]

const indicators = [
  ['Annual RS', '約 3／6／9／12 個月累積報酬，以 40%／20%／20%／20% 加權，再與所選基準（SPY 或 QQQ）正規化並做 0–99 排名。95 大致代表前 5%，不是漲幅 95%；屬於 IBD-style 近似排名。'],
  ['Utility RS', '依市場距高點的交易日數調整短期視窗，觀察修正期間的抗跌與轉強表現。排名越高，相對強勢越明顯；不要求股票本身一定上漲。'],
  ['Δ RS 20D', '今天的 Annual RS 減去 20 個交易日前的 Annual RS。78 →92 顯示 +14，代表排名提升 14 點，不是股價上漲 14%。'],
  ['RS Line', '股票調整後收盤價 ÷ 基準調整後收盤價。線向上代表這段期間跑贏所選基準（SPY 或 QQQ）；它是價格比值，不是 0–99 排名。'],
  ['RS Line 新高／領先價格', '「新高」表示 RS Line 到達近 252 個交易日高點（容許 0.01% 誤差）；「領先價格」表示 RS Line 已創高，但股價尚未到自身 52 週高點。'],
  ['Industry RS／Sector RS', 'Industry RS 為同產業股票的原始年度相對分數平均值；Sector RS 為同板塊 Annual RS 的中位數。各自另有 Percentile 百分位欄位，原始分數與百分位需分開解讀。'],
]

export function LeadershipGuide() {
  return <section aria-labelledby="leadership-guide-title" className="space-y-6 border-t border-white/10 pt-8">
    <div>
      <h2 id="leadership-guide-title" className="text-xl font-display text-on-s">指標與分類說明</h2>
      <p className="text-muted text-sm mt-2 leading-relaxed">分類可以同時成立。例如 Established · Resilient 表示同時具備年度領導地位與修正期韌性；各項分類供篩選與研究使用。</p>
    </div>

    <div className="grid gap-4 md:grid-cols-2">
      {classifications.map(({ name, meaning, rule }) => <article key={name} className="bg-cl p-5 space-y-3">
        <h3 className="text-primary text-sm font-semibold">{name}</h3>
        <p className="text-on-s text-sm leading-relaxed">{meaning}</p>
        <p className="text-muted text-sm leading-relaxed">判定條件：{rule}</p>
      </article>)}
    </div>

    <div className="bg-cl p-5">
      <h3 className="text-on-s font-semibold mb-4">RS 指標怎麼看</h3>
      <dl className="divide-y divide-white/5">
        {indicators.map(([name, meaning]) => <div key={name} className="grid gap-2 py-3 md:grid-cols-[12rem_1fr]">
          <dt className="text-primary text-sm">{name}</dt>
          <dd className="text-muted text-sm leading-relaxed">{meaning}</dd>
        </div>)}
      </dl>
    </div>

    <details className="bg-cl p-5">
      <summary className="text-on-s font-semibold cursor-pointer">Utility RS 的視窗、算法與 Utility Screen</summary>
      <div className="mt-4 space-y-4 text-sm text-muted leading-relaxed">
        <p>N 是所選基準（SPY 或 QQQ）距最近一次收盤創下 200 日滾動高點的交易日數。只有 10 ≤ N ≤200 時啟用 Utility；其餘時間顯示「—」。這個市場狀態依離高點的時間判定，沒有要求基準必須跌滿 10%。</p>
        <p>四個視窗為 N 的 25%、50%、75%、100%，四捨五入到整數交易日（正好半日時取最近的偶數），最少 1 日。每個視窗都從今天往回看，彼此重疊；最近的一段權重最大。</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <caption className="text-left text-on-s pb-2">範例：N＝40，使用以下視窗</caption>
            <thead><tr>{['視窗', '10 日', '20 日', '30 日', '40 日'].map(label => <th key={label} scope="col" className="p-2 whitespace-nowrap font-medium">{label}</th>)}</tr></thead>
            <tbody><tr>{['權重', '40%', '20%', '20%', '20%'].map((value, index) => index === 0 ? <th key={index} scope="row" className="p-2 font-medium">{value}</th> : <td key={index} className="p-2">{value}</td>)}</tr></tbody>
          </table>
        </div>
        <p>加權報酬 S＝0.4 ×第一視窗報酬＋0.2 ×第二視窗報酬＋0.2 ×第三視窗報酬＋0.2 ×第四視窗報酬。基準使用相同視窗與權重，再計算（1＋S股票）÷（1＋S_基準），對符合資料條件的股票做 0–99 百分位排名。相同分數可能合併排名區間；同一天 SPY 分母一致，因此排名主要反映股票的加權報酬。</p>
        <p>Utility Screen 是再加上條件的名單：Utility 啟用、Utility RS ≥85、價格高於 MA200、MA50 高於 MA200、20 日平均每日成交金額至少 1 億美元，且價格不低於 200 日高點的 75%。成交金額逐日以收盤價 ×成交量計算後取平均；此篩選不要求價格高於 52 週低點 30%。</p>
      </div>
    </details>

    <details className="bg-cl p-5">
      <summary className="text-on-s font-semibold cursor-pointer">Trend、市場狀態與資料更新</summary>
      <div className="mt-4 space-y-4 text-sm text-muted leading-relaxed">
        <p>Trend 的 0–9 分是九項技術條件通過的數量：價格高於 MA50、MA150、MA200（三項）；MA50 高於 MA150、MA150 高於 MA200（兩項）；MA200 高於 20 個交易日前；價格至少為 52 週低點的 130%；價格至少為 52 週高點的 75%；Annual RS ≥70。9/9 才是 Trend Template 完整通過。MA 表示最近指定交易日數的平均收盤價。</p>
        <p>市場狀態 NORMAL：距高點 0–9 個交易日；CORRECTION：10–200 日；EXTENDED_CORRECTION：超過 200 日。這些名稱描述距高點的時間，不等同於跌幅或牛熊市判定。</p>
        <p>每日抓取排程為台灣時間週二至週六早上 07:30，對應美股前一交易日收盤後；實際完成時間可能延遲，美股休市時資料日期可能不變。「更新資料」按鈕只重新讀取最近產生的結果。</p>
        <p>「—」代表未啟用、資料不足或該項不適用，不代表分數是 0。Annual RS 至少需要 252 個交易日資料；RS 動能需要對應日期的歷史快照，因此新啟用初期的 5／20／60 日變化可能留空。</p>
        <p>資料品質 OK 表示目前檢查無異常；MISSING_HISTORY／MISSING_VOLUME 表示歷史或成交量不足；MISSING_SECTOR／MISSING_INDUSTRY 表示分類資料缺失；PRICE_FETCH_ERROR 表示未取得日線；STALE_PRICE 表示缺少當期價格；POSSIBLE_SPLIT 表示近期調整後價格異常變動，需再確認公司事件。同一股票可能有多個標記。</p>
      </div>
    </details>
  </section>
}
