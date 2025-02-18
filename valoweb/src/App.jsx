import { useState, useEffect } from 'react'
import './App.css'
import riotLogo from './assets/rioticon.svg'

function App() {
  const [nickname, setNickname] = useState('')
  const [tag, setTag] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [account, setAccount] = useState(null)
  const [apiKey, setApiKey] = useState(null)
  const [loadingStatus, setLoadingStatus] = useState('')

  useEffect(() => {
    // 환경 변수 로딩 확인
    const key = import.meta.env.VITE_VALORANT_API_KEY
    console.log('=== 환경 변수 확인 ===')
    console.log('환경 변수 존재 여부:', !!key)
    console.log('환경 변수 길이:', key?.length)
    console.log('환경 변수 미리보기:', key ? `${key.substring(0, 10)}...` : 'undefined')
    console.log('==================')
    
    if (!key) {
      setError('API 키가 설정되지 않았습니다. 환경 변수를 확인해주세요.')
    } else {
      setApiKey(key)
    }
  }, [])

  const getEncouragementMessage = (stats) => {
    if (stats.currentStreak >= 3) {
      if (stats.isWinStreak) {
        return `${stats.currentStreak}연승 중! 놀라운 실력이에요! 🔥`
      } else {
        return `${stats.currentStreak}연패... 잠시 쉬고 다시 도전해보는 건 어떨까요? 😊`
      }
    }
    if (stats.recentWinRate >= 60) {
      return `최근 20경기 승률 ${stats.recentWinRate.toFixed(1)}%로 매우 좋은 성과를 보여주고 있어요! ⭐`
    }
    if (stats.recentWinRate >= 50) {
      return '안정적인 플레이를 보여주고 있어요. 오늘도 즐거운 발로란트 되세요! 🎮'
    }
    return '승률에 연연하지 말고 게임을 즐기세요! 실력은 자연스럽게 따라올 거예요! 💪'
  }

  const getAgentRecommendation = (stats) => {
    const { topAgents, playstyle } = stats
    if (playstyle === 'aggressive') {
      return ['Jett', 'Raze', 'Phoenix']
    }
    if (playstyle === 'defensive') {
      return ['Cypher', 'Killjoy', 'Sage']
    }
    return ['Omen', 'Brimstone', 'Sage'] // 기본 추천
  }

  const getWeaponRecommendation = (stats) => {
    const { topWeapons, accuracy } = stats
    if (accuracy > 25) {
      return ['Vandal', 'Guardian', 'Sheriff']
    }
    return ['Phantom', 'Spectre', 'Bulldog']
  }

  // 타임아웃 시간을 5초로 줄임
  const fetchWithTimeout = async (url, options, timeout = 5000) => {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      })
      clearTimeout(id)
      return response
    } catch (error) {
      clearTimeout(id)
      if (error.name === 'AbortError') {
        throw new Error('요청 시간이 초과되었습니다.')
      }
      throw error
    }
  }

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!nickname || !tag) return
    if (!apiKey) {
      setError('API 키가 설정되지 않았습니다.')
      return
    }
    
    setLoading(true)
    setError(null)
    setLoadingStatus('계정 정보를 검색중입니다...')
    
    // 기본 MMR 정보 객체 정의
    let mmrInfo = {
      currenttierpatched: '언랭크',
      ranking_in_tier: 0,
      images: null,
      highestrank: '정보 없음',
      elo: null
    }
    
    try {
      const encodedNickname = encodeURIComponent(nickname)
      const encodedTag = encodeURIComponent(tag)
      
      // 계정 정보 요청
      setLoadingStatus('계정 정보를 가져오는 중...')
      const response = await fetchWithTimeout(
        `/valorant-api/valorant/v1/account/${encodedNickname}/${encodedTag}`,
        {
          method: 'GET',
          headers: { 'Authorization': apiKey }
        }
      )

      console.log('=== API 응답 정보 ===')
      console.log('Status:', response.status)
      console.log('Status Text:', response.statusText)
      console.log('Headers:', Object.fromEntries(response.headers.entries()))
      console.log('Type:', response.type)
      console.log('URL:', response.url)
      console.log('==================')

      // 응답 본문을 텍스트로 먼저 받아서 로깅
      const responseText = await response.text()
      console.log('=== 응답 본문 ===')
      console.log('Raw response:', responseText)
      console.log('==================')

      if (!response.ok) {
        console.log('=== 에러 상세 정보 ===')
        console.log('Error Status:', response.status)
        console.log('Error Text:', responseText)
        console.log('==================')

        if (response.status === 401) {
          throw new Error('API 키가 잘못되었거나 인증에 실패했습니다. (API Key: ' + apiKey.substring(0, 10) + '...)')
        } else if (response.status === 404) {
          throw new Error('플레이어를 찾을 수 없습니다.')
        } else if (response.status === 429) {
          throw new Error('너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.')
        } else {
          throw new Error(`API 호출 실패 (${response.status}): ${responseText}`)
        }
      }

      // 텍스트를 JSON으로 파싱
      let data
      try {
        data = JSON.parse(responseText)
        console.log('=== 파싱된 JSON 데이터 ===')
        console.log('Parsed data:', data)
        console.log('==================')
      } catch (parseError) {
        console.error('JSON 파싱 에러:', parseError)
        throw new Error('응답 데이터 파싱 실패: ' + responseText.substring(0, 100))
      }

      if (data.status !== 200) {
        throw new Error(data.message || '계정을 찾을 수 없습니다.')
      }

      const accountData = data.data
      const region = accountData.region.toLowerCase()

      try {
        // MMR 정보 요청
        setLoadingStatus('MMR 정보를 가져오는 중...')
        const mmrResponse = await fetchWithTimeout(
          `/valorant-api/valorant/v3/mmr/${region}/pc/${encodedNickname}/${encodedTag}`,
          {
            method: 'GET',
            headers: { 'Authorization': apiKey }
          }
        )

        const mmrData = await mmrResponse.json()
        console.log('MMR 데이터:', mmrData)

        if (mmrData.data && mmrData.status === 200) {
          console.log('Raw MMR Data:', mmrData.data)
          
          mmrInfo = {
            currenttierpatched: mmrData.data.current.tier.name || '언랭크',
            ranking_in_tier: mmrData.data.current.rr || 0,
            images: {
              small: `https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04/${mmrData.data.current.tier.id}/smallicon.png`
            },
            highestrank: mmrData.data.peak.tier.name || '정보 없음',
            elo: mmrData.data.current.elo || null
          }
          console.log('처리된 MMR 정보:', mmrInfo)
        }

        // 전적 정보 요청
        setLoadingStatus('최근 전적을 분석하는 중...')
        const matchesResponse = await fetchWithTimeout(
          `/valorant-api/valorant/v3/matches/${region}/${encodedNickname}/${encodedTag}?size=5&queue=competitive`,
          {
            method: 'GET',
            headers: { 'Authorization': apiKey }
          },
          5000
        )

        const matchesData = await matchesResponse.json()
        console.log('전적 데이터:', matchesData)

        // 기본 통계 데이터 설정
        let defaultStats = {
          recentWinRate: 0,
          recentLosses: 0,
          topAgents: ['Jett', 'Sage', 'Omen'],
          topWeapons: ['Vandal', 'Phantom', 'Operator'],
          playstyle: 'balanced',
          accuracy: 22,
          currentStreak: 0,
          isWinStreak: false
        }

        if (matchesData.data && Array.isArray(matchesData.data)) {
          const recentMatches = matchesData.data
          console.log('분석할 매치 수:', recentMatches.length)

          if (recentMatches.length > 0) {
            let wins = 0
            let totalMatches = 0
            let currentStreak = 0
            let isWinStreak = null

            // 매치 데이터 분석
            recentMatches.forEach((match, index) => {
              if (match.metadata && match.players && match.teams) {
                const playerData = match.players.all_players.find(
                  player => player.name.toLowerCase() === nickname.toLowerCase() && 
                           player.tag.toLowerCase() === tag.toLowerCase()
                )
                
                if (playerData) {
                  totalMatches++
                  const playerTeam = playerData.team.toLowerCase()
                  const isWin = match.teams[playerTeam]?.has_won
                  
                  // 승패 카운트
                  if (isWin) wins++
                  
                  // 연승/연패 계산
                  if (index === 0) {
                    currentStreak = 1
                    isWinStreak = isWin
                  } else if ((isWin && isWinStreak) || (!isWin && !isWinStreak)) {
                    currentStreak++
                  }
                  
                  console.log(`매치 ${index + 1}: 팀 ${playerTeam}, 승리 ${isWin}`)
                }
              }
            })

            if (totalMatches > 0) {
              defaultStats.recentWinRate = (wins / totalMatches) * 100
              defaultStats.recentLosses = totalMatches - wins
              defaultStats.currentStreak = currentStreak
              defaultStats.isWinStreak = isWinStreak
              console.log(`승률 계산: ${wins}승 ${totalMatches - wins}패 (${defaultStats.recentWinRate.toFixed(1)}%)`)
              console.log(`연승/연패: ${currentStreak}${isWinStreak ? '연승' : '연패'}`)
            }
          }
        }

        // 계정 데이터 설정
        const accountWithStats = {
          ...accountData,
          mmr: mmrInfo,
          stats: defaultStats,
          encouragementMessage: getEncouragementMessage(defaultStats),
          recommendedAgents: getAgentRecommendation(defaultStats),
          recommendedWeapons: getWeaponRecommendation(defaultStats)
        }

        console.log('최종 계정 데이터:', accountWithStats)
        setAccount(accountWithStats)

      } catch (error) {
        console.error('전적 분석 오류:', error)
        // 오류 발생시에도 기본 데이터로 계정 정보 설정
        setAccount({
          ...accountData,
          mmr: mmrInfo,  // 기본 MMR 정보 사용
          stats: {
            recentWinRate: 0,
            recentLosses: 0,
            topAgents: ['Jett', 'Sage', 'Omen'],
            topWeapons: ['Vandal', 'Phantom', 'Operator'],
            playstyle: 'balanced',
            accuracy: 22,
            currentStreak: 0,
            isWinStreak: false
          }
        })
      }

    } catch (error) {
      console.error('=== 최종 에러 정보 ===')
      console.error('Error name:', error.name)
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
      console.error('==================')
      
      if (error.message.includes('시간이 초과')) {
        setError('서버 응답이 지연되고 있습니다. 잠시 후 다시 시도해주세요.')
      } else if (error.message.includes('API 키')) {
        setError('API 키 인증에 실패했습니다. 관리자에게 문의해주세요.')
      } else {
        setError(error.message || '계정 정보를 가져오는데 실패했습니다.')
      }
    } finally {
      setLoading(false)
      setLoadingStatus('')
    }
  }

  // 나머지 매치 데이터를 백그라운드에서 로딩하는 함수
  const fetchRemainingMatches = async (region, nickname, tag, apiKey) => {
    try {
      const response = await fetch(
        `/valorant-api/valorant/v3/matches/${region}/${nickname}/${tag}?size=20&queue=competitive&startIndex=10`,
        {
          method: 'GET',
          headers: { 'Authorization': apiKey }
        }
      )
      if (response.ok) {
        const data = await response.json()
        // 추가 데이터가 있으면 통계 업데이트
        if (data.data && data.data.length > 0) {
          // ... 필요한 경우 통계 업데이트
        }
      }
    } catch (error) {
      console.warn('추가 전적 로딩 실패:', error)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch(e)
    }
  }

  return (
    <div className="container">
      <h1>Valorant Helper</h1>
      <div className="input-container">
        <div className="input-group">
          <input 
            type="text" 
            placeholder="닉네임"
            className="nickname-input"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            onKeyPress={handleKeyPress}
          />
          <span className="separator">#</span>
          <input 
            type="text" 
            placeholder="태그"
            className="tag-input"
            maxLength="5"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            onKeyPress={handleKeyPress}
          />
          <button className="search-button" onClick={handleSearch} disabled={loading}>
            {loading ? (
              <span className="loading-icon">...</span>
            ) : (
              <img src={riotLogo} alt="Riot Logo" className="riot-logo" />
            )}
          </button>
        </div>
      </div>

      {loading && (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <div className="loading-text">{loadingStatus}</div>
          <div className="loading-subtext">잠시만 기다려주세요...</div>
        </div>
      )}
      {error && <div className="error-message">{error}</div>}
      
      {account && !loading && (
        <div className="result-container">
          {account.card && (
            <div className="player-banner">
              <img 
                src={account.card.wide || account.card.large || account.card.small} 
                alt="Player Banner"
                className="banner-image"
              />
              <div className="player-info-overlay">
                <h2 className="welcome-message">
                  {account.name}
                  {account.accolades?.title && (
                    <span className="player-title">{account.accolades.title}</span>
                  )}
                </h2>
                <p className="player-tag">#{account.tag}</p>
              </div>
            </div>
          )}
          
          <div className="info-grid">
            <div className="account-info">
              <h3 className="section-title">계정 정보</h3>
              <p>레벨: {account.account_level}</p>
              <p>리전: {account.region.toUpperCase()}</p>
              {account.last_update && !isNaN(new Date(account.last_update)) ? (
                <p>마지막 업데이트: {new Date(account.last_update).toLocaleDateString('ko-KR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}</p>
              ) : null}
            </div>

            {account.mmr && (
              <div className="rank-info">
                <h3 className="section-title">랭크 정보</h3>
                <div className="rank-display">
                  {account.mmr.images?.small && (
                    <img 
                      src={account.mmr.images.small}
                      alt={account.mmr.currenttierpatched}
                      className="rank-icon"
                    />
                  )}
                  <div className="rank-details">
                    <p className="current-rank">{account.mmr.currenttierpatched || '언랭크'}</p>
                    <p className="rank-rating">레이팅: {account.mmr.ranking_in_tier || 0} RR</p>
                    <p className="peak-rank">최고 랭크: {account.mmr.highestrank || '정보 없음'}</p>
                    {account.mmr.elo && (
                      <p className="elo">ELO: {account.mmr.elo}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {account.stats && (
              <div className="stats-container">
                <h3 className="section-title">최근 전적</h3>
                <div className="stats-content">
                  <div className={`win-rate-circle ${
                    account.stats.recentWinRate >= 60 ? 'win-rate-high' : 
                    account.stats.recentWinRate >= 45 ? 'win-rate-medium' : 
                    'win-rate-low'
                  }`}>
                    <svg viewBox="0 0 36 36" className="circular-chart">
                      <path
                        d="M18 2.0845
                          a 15.9155 15.9155 0 0 1 0 31.831
                          a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        className="background"
                      />
                      <path
                        d="M18 2.0845
                          a 15.9155 15.9155 0 0 1 0 31.831
                          a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        strokeWidth="3"
                        className="progress"
                        strokeDasharray={`${account.stats.recentWinRate}, 100`}
                      />
                      <text x="18" y="18" dy=".35em" className="percentage">
                        {account.stats.recentWinRate.toFixed(0)}%
                      </text>
                    </svg>
                    <div className="win-rate-label">최근 5경기 승률</div>
                  </div>
                  <p className="encouragement">{account.encouragementMessage}</p>
                </div>
              </div>
            )}

            <div className="recommendations">
              <h3 className="section-title">오늘의 추천</h3>
              <div className="recommendations-grid">
                <div className="recommendation-box agents">
                  <h4>추천 요원</h4>
                  <ul>
                    {account.recommendedAgents?.map((agent, index) => (
                      <li key={agent} style={{"--item-index": index}}>
                        {agent}
                      </li>
                    )) || <li>추천 정보를 불러올 수 없습니다</li>}
                  </ul>
                </div>
                <div className="recommendation-box weapons">
                  <h4>추천 무기</h4>
                  <ul>
                    {account.recommendedWeapons?.map((weapon, index) => (
                      <li key={weapon} style={{"--item-index": index}}>
                        {weapon}
                      </li>
                    )) || <li>추천 정보를 불러올 수 없습니다</li>}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App