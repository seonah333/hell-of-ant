# HELL OF ANT · 개미지옥 행사 캘린더

누구나 행사를 제보하고, 운영진이 승인하면 게시되는 커뮤니티 행사 캘린더예요.

- 방문자: 로그인 없이 일정 보기, 행사 제보하기
- 운영진: 이메일 로그인 → 제보 승인·수정·반려, 일정 직접 등록·수정·삭제

## 파일 구성

| 파일 | 역할 |
|---|---|
| `index.html` | 화면 (디자인) |
| `app.js` | 동작 |
| `config.js` | Supabase 주소와 공개 키 (직접 채워야 해요) |
| `supabase/schema.sql` | 데이터베이스, 권한, 이미지 저장소 설정 |

---

## 오픈 순서 (약 30~40분)

### 1. 계정 만들기 (무료)

- GitHub: https://github.com
- Supabase: https://supabase.com (GitHub 계정으로 가입하면 편해요)
- Vercel: https://vercel.com (GitHub 계정으로 가입하면 편해요)

> 회사 계정 말고 개인 계정이나 커뮤니티 공용 계정으로 만드는 걸 추천해요.

### 2. Supabase 프로젝트 만들기

1. Supabase 대시보드 → **New project**
2. Name: `hell-of-ant` / Region: **Northeast Asia (Seoul)** / Database password는 안전한 곳에 저장해 두세요.
3. 프로젝트가 준비될 때까지 1~2분 기다려요.

### 3. 데이터베이스 설정

1. 왼쪽 메뉴 **SQL Editor** → **New query**
2. `supabase/schema.sql` 파일 내용을 전부 붙여넣고 **Run**
3. 아래쪽에 `Success. No rows returned` 가 보이면 완료예요.

### 4. 운영진 로그인 설정

1. **Authentication → Sign In / Providers**: Email 이 켜져 있는지 확인하고, **Allow new users to sign up** 은 **끄기**  
   (운영진이 아닌 사람이 계정을 만들지 못하게 해요)
2. **Authentication → Users → Add user → Send invitation**: 운영진 이메일을 초대해요. (서나님 포함)
3. **SQL Editor** 에서 운영진마다 아래를 실행해요. 이름은 일정에 '등록: 이름'으로 표시돼요.

```sql
insert into public.admins (user_id, display_name)
select id, '서나' from auth.users where email = '운영진이메일@example.com';
```

### 5. config.js 채우기

**Project Settings → API** (또는 **API Keys**) 에서 두 값을 복사해 `config.js` 에 넣어요.

```js
supabaseUrl: "https://xxxxxxxx.supabase.co",   // Project URL
supabaseAnonKey: "eyJhbGciOi...",              // anon public 키
```

> ⚠️ `service_role` 키는 절대 넣지 마세요. 이 키가 노출되면 누구나 모든 데이터를 바꿀 수 있어요.

### 6. GitHub에 올리기

1. GitHub → **New repository** → 이름 `hell-of-ant` → **Public** 또는 **Private** → Create
2. **uploading an existing file** 링크 → 이 폴더의 파일을 폴더 구조 그대로 끌어다 놓기 → **Commit changes**

### 7. Vercel로 배포

1. Vercel → **Add New → Project** → `hell-of-ant` 저장소 **Import**
2. Framework Preset: **Other**, 나머지는 그대로 → **Deploy**
3. 완료되면 주소가 생겨요. 예: `https://hell-of-ant.vercel.app`

### 8. 로그인 주소 연결

Supabase **Authentication → URL Configuration**

- **Site URL**: 7단계에서 받은 주소
- **Redirect URLs**: 같은 주소를 추가

이걸 안 하면 운영진 로그인 메일의 링크가 다른 곳으로 이동해요.

### 9. 오픈 전 테스트

- [ ] 시크릿 창에서 사이트 열기 → 일정 목록이 보여요 (처음엔 비어 있어요)
- [ ] 시크릿 창에서 **+ ADD EVENT** → 제보하기 → 'THANK YOU' 화면
- [ ] 일반 창에서 페이지 맨 아래 **운영진 로그인** → 메일의 링크 클릭 → 상단에 **승인 대기 1**
- [ ] **승인** → 시크릿 창에서 새로고침하면 일정이 보여요
- [ ] 휴대폰으로 열어서 화면 확인

### 10. 인스타그램에 연결

@hoa__official 프로필 편집 → 링크에 사이트 주소 추가

---

## 운영 가이드

- **승인 대기 확인**: 운영진으로 로그인하면 상단에 '승인 대기 N' 버튼이 생겨요.
- **수정 후 승인**: 제목 오타나 장르를 고친 뒤 바로 게시할 수 있어요.
- **반려**: 제보와 플라이어 이미지가 함께 삭제돼요.
- **제보자 정보**: 인스타 아이디와 남긴 말은 운영진만 볼 수 있어요. 제보자가 동의한 경우에만 일정에 '제보 @아이디'로 표시돼요.
- **스팸 방지**: 같은 접속지에서 1시간에 5건까지만 제보할 수 있고, 승인 대기가 300건을 넘으면 제보를 잠시 받지 않아요.

## 무료 플랜 참고

- Supabase 무료 프로젝트는 오랫동안 사용이 없으면 일시 정지될 수 있어요. 정지되면 대시보드에서 **Restore** 를 누르면 돼요.
- 이미지 저장 공간은 무료 플랜 한도 안에서 충분해요. 플라이어는 업로드 전에 자동으로 1600px 이하로 줄여요.

## 도메인을 연결하고 싶을 때

Vercel 프로젝트 → **Settings → Domains** 에서 구매한 도메인을 추가하고, 8단계의 주소도 새 도메인으로 바꿔 주세요.
