import type { Resource } from "i18next";

export const resources = {
  md: {
    translation: {
      common: {
        brand: "CIVIS",
        languageSwitcher: {
          ariaLabel: "Schimbă limba"
        },
        accessibility: {
          closeDialog: "Închide dialogul"
        },
        actions: {
          login: "Autentificare",
          logout: "Ieșire",
          loggingOut: "Se închide sesiunea...",
          admin: "Admin",
          backToChat: "Întoarce-te la chat",
          startConversation: "Întreabă asistentul",
          accessAdmin: "Accesează"
        },
        states: {
          loading: "Se încarcă..."
        }
      },
      home: {
        eyebrow: "Informații publice, explicate clar",
        title: "Asistentul digital al Primăriei",
        description:
          "CIVIS găsește informația relevantă în documentele publice ale Primăriei și răspunde în română sau rusă, indicând documentul și fragmentul folosit.",
        chatCard: {
          title: "Întreabă CIVIS",
          description:
            "Află ce prevăd deciziile, regulamentele și procedurile municipale. Dacă informația lipsește sau sursele se contrazic, asistentul îți va spune clar."
        },
        adminCard: {
          title: "Panou de administrare",
          description:
            "Gestionează corpusul de documente publice, șabloanele, feedbackul, calitatea răspunsurilor și costurile modelelor AI."
        }
      },
      auth: {
        adminPanelTitle: "Panoul de administrare",
        fields: {
          email: "Email",
          password: "Parolă"
        },
        placeholders: {
          email: "admin@civis.local",
          password: "••••••••"
        },
        validation: {
          emailRequired: "Introduceți adresa de email",
          passwordRequired: "Introduceți parola",
          passwordMin: "Parola trebuie să aibă cel puțin 8 caractere"
        },
        errors: {
          credentials: "Email sau parolă incorectă"
        },
        accessibility: {
          showPassword: "Arată parola",
          hidePassword: "Ascunde parola",
          emailIcon: "Pictogramă email",
          passwordIcon: "Pictogramă parolă"
        }
      },
      chat: {
        status: {
          noMessages: "Niciun mesaj.",
          streamError: "Eroare la încărcarea răspunsului."
        },
        welcome: {
          title: "Bine ai venit la CIVIS",
          subtitle: "Cu ce întrebare despre serviciile municipale te putem ajuta?",
          faqLabel: "Întrebări frecvente"
        },
        greeting: {
          intro:
            "Bună ziua! 👋 Sunt CIVIS, asistentul digital al Primăriei. Caut răspunsul în documentele publice disponibile și indic sursa exactă. Dacă informația lipsește sau documentele se contrazic, vă voi avertiza.",
          question: "Cu ce vă pot ajuta?"
        },
        promptUpgrade: {
          title: "Îmbunătățește întrebarea",
          badge: "Smart",
          enable: "Activează sugestiile în timp ce scrii",
          disable: "Dezactivează sugestiile în timp ce scrii",
          emptyInput: "Mai întâi scrie întrebarea ta."
        },
        composer: {
          placeholder: "Întreabă despre o decizie, procedură sau serviciu municipal...",
          send: "Trimite mesajul",
          sending: "Se trimite mesajul"
        },
        jumpToLatest: {
          ariaLabel: "Derulează la ultimele mesaje",
          title: "Mesaje noi"
        },
        message: {
          assistantTyping: "Asistentul scrie",
          details: "Vezi sursele",
          noSources: "Informația necesară nu a fost găsită în corpusul disponibil.",
          loadingSources: "Se încarcă sursele...",
          loadSourcesFailed: "Nu s-au putut încărca sursele",
          source: "Document citat",
          unknown: "necunoscut",
          similarity: "Similaritate"
        },
        feedback: {
          intro:
            "Cum ți s-a părut experiența? Evaluează conversația și ajută-ne să îmbunătățim asistentul.",
          helpful: "Util",
          notHelpful: "Neutil",
          saving: "Se salvează...",
          commentPlaceholder: "Comentează...",
          submitComment: "Trimite comentariul",
          submitFailed: "Trimiterea feedback-ului a eșuat"
        },
        session: {
          new: "Sesiune nouă",
          modeScreenReader: "Regim sesiune: obișnuit. Expiră la: {{expiresLabel}}",
          unknownExpiry: "necunoscut",
          hintNeedsAnswer: "Trimite un mesaj și așteaptă răspunsul pentru a începe un chat nou",
          hintNewSession: "Încheie sesiunea și începe un chat nou",
          terminateFailed: "Sesiunea nu a putut fi încheiată"
        },
        faq: {
          loadFailed: "Nu s-au putut încărca întrebările FAQ",
          empty: "Nu există întrebări FAQ active."
        },
        prompts: {
          loadFailed: "Nu s-au putut încărca șabloanele de prompt",
          empty: "Nu există șabloane active."
        }
      },
      admin: {
        nav: {
          backToChat: "Înapoi la chat",
          knowledge: "Bază de cunoștințe",
          feedback: "Feedback",
          prompts: "Șabloane prompt",
          faq: "FAQ",
          health: "Stare sistem"
        },
        knowledge: {
          title: "Bază de cunoștințe",
          description: "Corpusul controlat de decizii, regulamente și proceduri publice ale Primăriei.",
          uploadButton: "Încarcă fișierul",
          searchPlaceholder: "Caută",
          searchAriaLabel: "Caută fișiere",
          loadFailed: "Nu s-a putut încărca lista fișierelor",
          deleteFailed: "Ștergerea a eșuat",
          downloadFailed: "Descărcarea a eșuat",
          reindexFailed: "Reindexarea a eșuat"
        },
        fileUpload: {
          title: "Încarcă document",
          description:
            "Formate: PDF, DOCX, TXT, MD, PNG, JPG, WEBP. Dimensiune maximă: {{size}} MB.",
          unsupported: "Sunt acceptate doar fișiere PDF, DOCX, TXT, MD.",
          fileTooLarge: "Fișierul depășește limita de {{size}} MB.",
          uploadFailed: "Încărcarea a eșuat",
          uploaded: "Fișierul {{name}} a fost încărcat.",
          buttonUploading: "Se încarcă...",
          footer:
            "După încărcare, documentul va intra automat în pipeline-ul de indexare."
        },
        fileTable: {
          title: "Fișiere încărcate",
          countOne: "1 fișier în baza de cunoștințe",
          countOther: "{{count}} fișiere în baza de cunoștințe",
          refreshing: "Actualizare...",
          sortBy: "Sortează după:",
          newest: "Noi",
          oldest: "Vechi",
          columns: {
            name: "Denumire",
            size: "Mărimea fișierului",
            uploadedAt: "Data încărcării",
            status: "Statut",
            chunks: "Fragmente",
            actions: "Acțiuni"
          },
          status: {
            pending: "În așteptare",
            processing: "În procesare",
            ready: "Finalizat",
            error: "Eroare"
          },
          openActions: "Deschide acțiunile",
          actions: {
            reindex: "Reindexează",
            save: "Salvează",
            delete: "Șterge"
          },
          confirmDelete: "Ștergi {{name}} și toate chunk-urile indexate?",
          emptyTitle: "Nu există fișiere pentru filtrele selectate.",
          emptyDescription:
            "Încarcă un document nou sau schimbă căutarea/sortarea pentru a vedea rezultate.",
          pagination: {
            label: "Navigare prin fișiere",
            previous: "Anterioară",
            next: "Următoarea",
            page: "Pagina {{page}} / {{totalPages}}"
          }
        },
        feedback: {
          title: "Feedback",
          description: "Recenziile utilizatorilor despre funcționarea asistentului AI",
          refresh: "Actualizează",
          exportCsv: "Exportă CSV",
          loadFailed: "Nu s-au putut încărca analizele de feedback",
          negativeTitle: "Feedback negativ",
          negativeDescription: "Mesajele care au primit evaluări negative în conversațiile recente.",
          columns: {
            date: "Data",
            user: "Utilizator",
            comment: "Comentariu",
            message: "Mesaj",
            session: "Sesiune"
          },
          emptyTitle: "Nu există feedback negativ",
          emptyDescription: "Utilizatorii au oferit până acum feedback pozitiv.",
          pagination: {
            showing: "Afișare {{from}}-{{to}} din {{total}}",
            previous: "Anterioară",
            next: "Următoarea",
            page: "Pagina {{page}} / {{totalPages}}"
          }
        },
        feedbackChart: {
          empty: "Nu există încă date pentru grafic.",
          cards: {
            totalReviews: "Total recenzii",
            positive: "Pozitive",
            negative: "Negative",
            comments: "Comentarii"
          },
          lines: {
            positivePercent: "Pozitive %",
            negativePercent: "Negative %",
            positive: "Pozitive",
            negative: "Negative"
          },
          statsTitle: "Statistici",
          statsDescription: "% din recenzii pe zi",
          histogramTitle: "Histogramă",
          histogramDescription: "Număr de recenzii pe zi"
        },
        prompts: {
          title: "Șabloane prompt",
          description: "Gestionarea șabloanelor de prompturi pentru asistentul AI.",
          loadFailed: "Nu s-au putut încărca șabloanele de prompt",
          createFailed: "Crearea șablonului a eșuat.",
          updateFailed: "Actualizarea șablonului a eșuat.",
          deleteFailed: "Ștergerea a eșuat",
          invalidPayload:
            "Datele introduse nu sunt valide. Verifică titlul, conținutul, categoria și poziția.",
          refresh: "Actualizare...",
          hideForm: "Ascunde formularul",
          createTemplate: "Creează șablon",
          newTitle: "Șablon nou",
          fields: {
            title: "Titlu",
            category: "Categorie",
            content: "Conținut",
            order: "Ordine",
            active: "Activ"
          },
          create: "Creare",
          cancel: "Anulează",
          editTitle: "Editează șablonul",
          editDescription: "Editează rapid șablonul direct din pagină.",
          save: "Salvează",
          saving: "Se salvează...",
          saveChanges: "Salvează modificările",
          subtitleFallback: "Șablon reutilizabil pentru asistentul AI",
          categoryPrefix: "Categorie: {{category}}",
          actions: {
            edit: "Editează",
            deactivate: "Dezactivează",
            activate: "Activează",
            delete: "Șterge"
          },
          general: "General",
          emptyTitle: "Nu există șabloane definite.",
          emptyDescription: "Creează primul șablon din butonul „Creează șablon”.",
          confirmDelete: "Ștergi acest șablon?"
        },
        faq: {
          title: "FAQ",
          description: "Gestionarea întrebărilor frecvente pentru asistentul AI.",
          loadFailed: "Nu s-au putut încărca elementele FAQ",
          createFailed: "Crearea FAQ-ului a eșuat.",
          updateFailed: "Actualizarea FAQ-ului a eșuat.",
          deleteFailed: "Ștergerea a eșuat",
          invalidPayload:
            "Datele introduse nu sunt valide. Verifică întrebarea, răspunsul, categoria și ordinea.",
          refresh: "Actualizare...",
          hideForm: "Ascunde formularul",
          createFaq: "Creare FAQ",
          newTitle: "Element FAQ nou",
          fields: {
            question: "Întrebare",
            answer: "Răspuns",
            category: "Categorie",
            order: "Ordine",
            active: "Activ"
          },
          create: "Creează",
          creating: "Se creează...",
          cancel: "Anulează",
          editTitle: "Editează FAQ",
          editDescription: "Editează rapid conținutul fără să ieși din pagină.",
          save: "Salvează",
          saving: "Se salvează...",
          subtitleFallback: "Întrebări frecvente pentru asistent",
          categoryPrefix: "Categorie: {{category}}",
          empty: "Nu există elemente FAQ.",
          orderBadge: "Ordine: {{order}}",
          activeBadge: "Activ",
          inactiveBadge: "Inactiv",
          updatedAt: "Actualizat: {{date}}",
          actions: "Acțiuni",
          edit: "Editează",
          deactivate: "Dezactivează",
          activate: "Activează",
          deleting: "Se șterge...",
          delete: "Șterge",
          confirmDelete: "Ștergi acest element FAQ?"
        },
        healthPage: {
          title: "Stare sistem",
          description:
            "Monitorizarea serviciilor, estimarea bugetului lunar pentru modele, distribuția utilizării și riscul răspunsurilor fără suport documentar."
        },
        healthPanel: {
          badge: {
            ok: "OK",
            warn: "WARN",
            unavailable: "N/A",
            error: "ERROR",
            loading: "..."
          },
          fallback: {
            notAvailable: "n/a"
          },
          format: {
            milliseconds: "{{value}} ms"
          },
          errors: {
            loadFailed: "Nu s-a putut încărca monitorizarea sistemului",
            loadGeneric: "Eroare la încărcare"
          },
          hero: {
            title: "Panou de monitorizare",
            description:
              "O vedere compactă pentru starea serviciilor, consumul AI, costurile modelelor și calitatea răspunsurilor.",
            emptyTelemetry:
              "Telemetria exactă este goală deoarece nu a fost înregistrat încă niciun chat nou după activarea telemetriei. Trimite un mesaj nou în chat după repornirea aplicației pentru a popula tokenii exacți, costurile exacte și utilizarea evaluatorului.",
            missingPricing: "Lipsește prețul pentru: {{models}}",
            updated: "Actualizat: {{timestamp}}"
          },
          services: {
            openai: "OpenAI",
            redis: "Redis",
            database: "Bază de date",
            statusOk: "OK",
            statusFail: "EȘEC",
            latency: "Latență: {{value}} ms",
            model: "Model: {{value}}",
            databaseExtra: "Chunk-uri: {{chunks}} | Mesaje: {{messages}}"
          },
          usage: {
            title: "Rezumat utilizare",
            summary: "rezumat 24h + 30d",
            cards: {
              tokens24hLabel: "Tokeni 24h",
              tokens24hHint: "{{value}} cereri",
              spend30dLabel: "Cost 30d",
              spend30dHint: "{{value}} tokeni în total",
              coverageLabel: "Acoperire",
              coverageHint: "{{exact}} / {{assistant}} mesaje",
              judgedLabel: "Evaluări",
              judgedHint: "{{value}} răspunsuri evaluate"
            },
            trend: {
              title: "Evoluția tokenilor",
              description: "Volumul tokenilor din ultimele 30 de zile",
              series: "Tokeni"
            },
            windowTable: {
              columns: {
                window: "Fereastră",
                tokens: "Tokeni",
                avgRisk: "Risc mediu",
                judged: "Evaluări",
                needsReview: "Necesită revizie"
              }
            },
            modelBreakdown: "Distribuție pe modele",
            modelTable: {
              columns: {
                model: "Model",
                operation: "Operație",
                tokens: "Tokeni",
                spend: "Cost",
                latency: "Latență"
              },
              pricingGap: "lipsă preț",
              noData: "Nu există încă utilizare pe modele."
            }
          },
          quality: {
            title: "Rezumat calitate",
            summary: "ultimele 30d",
            cards: {
              averageRiskLabel: "Risc mediu",
              averageRiskHint: "p95 {{value}}",
              judgedCoverageLabel: "Acoperire evaluată",
              judgedCoverageHint: "{{value}} răspunsuri evaluate",
              needsReviewLabel: "Necesită revizie",
              needsReviewHint: "răspunsuri cu scor >= 0.85",
              latestHighScoreLabel: "Cel mai recent scor ridicat",
              latestHighScoreHint: "răspuns singular; graficul arată agregări zilnice",
              noLatestHighScoreHint: "nu există răspunsuri recente care necesită revizie"
            },
            trend: {
              title: "Evoluția riscului de suport",
              description: "Scorul mediu și p95 al riscului de suport pe zi",
              averageSeries: "Medie",
              p95Series: "P95"
            },
            interpretation: {
              title: "Interpretare și motive frecvente",
              line1: "Acesta este un scor de risc de suport, nu un scor de adevăr.",
              line2: "Valorile mai mari înseamnă că răspunsul se bazează mai mult pe suport slab sau lipsă în contextul recuperat.",
              line3:
                "Un scor precum 0.8 poate fi totuși doar un avertisment strict privind sprijinul contextual slab, nu neapărat o halucinație reală.",
              noReasons: "Nu există încă motive de evaluare."
            },
            riskyTable: {
              columns: {
                date: "Data",
                model: "Model",
                score: "Scor",
                reason: "Motiv",
                feedback: "Feedback",
                excerpt: "Fragment"
              },
              empty: "Nu au fost găsite răspunsuri care necesită revizie în ultimele 30 de zile."
            }
          }
        }
      }
    }
  },
  ru: {
    translation: {
      common: {
        brand: "CIVIS",
        languageSwitcher: {
          ariaLabel: "Сменить язык"
        },
        accessibility: {
          closeDialog: "Закрыть диалог"
        },
        actions: {
          login: "Войти",
          logout: "Выйти",
          loggingOut: "Выход из системы...",
          admin: "Админ",
          backToChat: "Вернуться в чат",
          startConversation: "Задать вопрос",
          accessAdmin: "Войти в админ-панель"
        },
        states: {
          loading: "Загрузка..."
        }
      },
      home: {
        eyebrow: "Публичная информация простым языком",
        title: "Цифровой помощник мэрии",
        description:
          "CIVIS находит нужную информацию в публичных документах мэрии и отвечает на русском или румынском языке, указывая документ и точный фрагмент.",
        chatCard: {
          title: "Спросить CIVIS",
          description:
            "Узнайте, что говорится в муниципальных решениях, регламентах и процедурах. Если данных нет или источники противоречат друг другу, помощник сообщит об этом."
        },
        adminCard: {
          title: "Админ-панель",
          description:
            "Управляйте корпусом публичных документов, шаблонами, отзывами, качеством ответов и затратами на AI-модели."
        }
      },
      auth: {
        adminPanelTitle: "Панель администрирования",
        fields: {
          email: "Email",
          password: "Пароль"
        },
        placeholders: {
          email: "admin@civis.local",
          password: "••••••••"
        },
        validation: {
          emailRequired: "Введите адрес электронной почты",
          passwordRequired: "Введите пароль",
          passwordMin: "Пароль должен содержать не менее 8 символов"
        },
        errors: {
          credentials: "Неверный email или пароль"
        },
        accessibility: {
          showPassword: "Показать пароль",
          hidePassword: "Скрыть пароль",
          emailIcon: "Иконка email",
          passwordIcon: "Иконка пароля"
        }
      },
      chat: {
        status: {
          noMessages: "Сообщений нет.",
          streamError: "Не удалось загрузить ответ."
        },
        welcome: {
          title: "Добро пожаловать в CIVIS",
          subtitle: "Что вы хотите узнать о муниципальных услугах?",
          faqLabel: "Частые вопросы"
        },
        greeting: {
          intro:
            "Здравствуйте! 👋 Я CIVIS, цифровой помощник мэрии. Я ищу ответ в доступных публичных документах и указываю точный источник. Если информации нет или документы противоречат друг другу, я предупрежу об этом.",
          question: "Чем я могу помочь?"
        },
        promptUpgrade: {
          title: "Улучшите запрос",
          badge: "Smart",
          enable: "Включить подсказки во время ввода",
          disable: "Отключить подсказки во время ввода",
          emptyInput: "Сначала напишите ваш вопрос."
        },
        composer: {
          placeholder: "Спросите о решении, процедуре или муниципальной услуге...",
          send: "Отправить сообщение",
          sending: "Сообщение отправляется"
        },
        jumpToLatest: {
          ariaLabel: "Прокрутить к последним сообщениям",
          title: "Новые сообщения"
        },
        message: {
          assistantTyping: "Ассистент печатает",
          details: "Показать источники",
          noSources: "Нужная информация не найдена в доступном корпусе документов.",
          loadingSources: "Источники загружаются...",
          loadSourcesFailed: "Не удалось загрузить источники",
          source: "Цитируемый документ",
          unknown: "неизвестно",
          similarity: "Сходство"
        },
        feedback: {
          intro:
            "Как вам опыт? Оцените разговор и помогите нам улучшить ассистента.",
          helpful: "Полезно",
          notHelpful: "Не полезно",
          saving: "Сохраняется...",
          commentPlaceholder: "Добавьте комментарий...",
          submitComment: "Отправить комментарий",
          submitFailed: "Не удалось отправить отзыв"
        },
        session: {
          new: "Новая сессия",
          modeScreenReader: "Режим сессии: обычный. Истекает: {{expiresLabel}}",
          unknownExpiry: "неизвестно",
          hintNeedsAnswer: "Отправьте сообщение и дождитесь ответа, чтобы начать новый чат",
          hintNewSession: "Завершить сессию и начать новый чат",
          terminateFailed: "Не удалось завершить сессию"
        },
        faq: {
          loadFailed: "Не удалось загрузить FAQ",
          empty: "Нет активных FAQ."
        },
        prompts: {
          loadFailed: "Не удалось загрузить шаблоны промптов",
          empty: "Нет активных шаблонов."
        }
      },
      admin: {
        nav: {
          backToChat: "Назад в чат",
          knowledge: "База знаний",
          feedback: "Отзывы",
          prompts: "Шаблоны промптов",
          faq: "FAQ",
          health: "Состояние системы"
        },
        knowledge: {
          title: "База знаний",
          description: "Контролируемый корпус публичных решений, регламентов и процедур мэрии.",
          uploadButton: "Загрузить файл",
          searchPlaceholder: "Поиск",
          searchAriaLabel: "Поиск файлов",
          loadFailed: "Не удалось загрузить список файлов",
          deleteFailed: "Не удалось удалить файл",
          downloadFailed: "Не удалось скачать файл",
          reindexFailed: "Не удалось переиндексировать файл"
        },
        fileUpload: {
          title: "Загрузить документ",
          description:
            "Форматы: PDF, DOCX, TXT, MD, PNG, JPG, WEBP. Максимальный размер: {{size}} МБ.",
          unsupported: "Поддерживаются только PDF, DOCX, TXT и MD.",
          fileTooLarge: "Файл превышает лимит {{size}} МБ.",
          uploadFailed: "Загрузка не удалась",
          uploaded: "Файл {{name}} загружен.",
          buttonUploading: "Загрузка...",
          footer:
            "После загрузки документ автоматически попадет в пайплайн индексации."
        },
        fileTable: {
          title: "Загруженные файлы",
          countOne: "1 файл в базе знаний",
          countOther: "{{count}} файлов в базе знаний",
          refreshing: "Обновление...",
          sortBy: "Сортировать по:",
          newest: "Новые",
          oldest: "Старые",
          columns: {
            name: "Название",
            size: "Размер файла",
            uploadedAt: "Дата загрузки",
            status: "Статус",
            chunks: "Фрагменты",
            actions: "Действия"
          },
          status: {
            pending: "В ожидании",
            processing: "В обработке",
            ready: "Готово",
            error: "Ошибка"
          },
          openActions: "Открыть действия",
          actions: {
            reindex: "Переиндексировать",
            save: "Сохранить",
            delete: "Удалить"
          },
          confirmDelete: "Удалить {{name}} и все индексированные фрагменты?",
          emptyTitle: "Нет файлов для выбранных фильтров.",
          emptyDescription:
            "Загрузите новый документ или измените поиск/сортировку, чтобы увидеть результаты.",
          pagination: {
            label: "Навигация по файлам",
            previous: "Назад",
            next: "Вперед",
            page: "Страница {{page}} / {{totalPages}}"
          }
        },
        feedback: {
          title: "Отзывы",
          description: "Отзывы пользователей о работе AI-ассистента",
          refresh: "Обновить",
          exportCsv: "Экспорт CSV",
          loadFailed: "Не удалось загрузить аналитику отзывов",
          negativeTitle: "Негативные отзывы",
          negativeDescription: "Сообщения, получившие отрицательную оценку в недавних разговорах.",
          columns: {
            date: "Дата",
            user: "Пользователь",
            comment: "Комментарий",
            message: "Сообщение",
            session: "Сессия"
          },
          emptyTitle: "Негативных отзывов нет",
          emptyDescription: "Пока пользователи оставляли только положительные отзывы.",
          pagination: {
            showing: "Показано {{from}}-{{to}} из {{total}}",
            previous: "Назад",
            next: "Вперед",
            page: "Страница {{page}} / {{totalPages}}"
          }
        },
        feedbackChart: {
          empty: "Для графика пока нет данных.",
          cards: {
            totalReviews: "Всего отзывов",
            positive: "Позитивные",
            negative: "Негативные",
            comments: "Комментарии"
          },
          lines: {
            positivePercent: "Позитивные %",
            negativePercent: "Негативные %",
            positive: "Позитивные",
            negative: "Негативные"
          },
          statsTitle: "Статистика",
          statsDescription: "% отзывов по дням",
          histogramTitle: "Гистограмма",
          histogramDescription: "Количество отзывов по дням"
        },
        prompts: {
          title: "Шаблоны промптов",
          description: "Управление шаблонами промптов для AI-ассистента.",
          loadFailed: "Не удалось загрузить шаблоны промптов",
          createFailed: "Не удалось создать шаблон.",
          updateFailed: "Не удалось обновить шаблон.",
          deleteFailed: "Удаление не удалось",
          invalidPayload:
            "Введенные данные некорректны. Проверьте заголовок, содержимое, категорию и порядок.",
          refresh: "Обновление...",
          hideForm: "Скрыть форму",
          createTemplate: "Создать шаблон",
          newTitle: "Новый шаблон",
          fields: {
            title: "Заголовок",
            category: "Категория",
            content: "Содержимое",
            order: "Порядок",
            active: "Активен"
          },
          create: "Создать",
          cancel: "Отмена",
          editTitle: "Редактировать шаблон",
          editDescription: "Быстро отредактируйте шаблон прямо на странице.",
          save: "Сохранить",
          saving: "Сохранение...",
          saveChanges: "Сохранить изменения",
          subtitleFallback: "Переиспользуемый шаблон для AI-ассистента",
          categoryPrefix: "Категория: {{category}}",
          actions: {
            edit: "Редактировать",
            deactivate: "Деактивировать",
            activate: "Активировать",
            delete: "Удалить"
          },
          general: "Общее",
          emptyTitle: "Шаблоны еще не созданы.",
          emptyDescription: "Создайте первый шаблон кнопкой «Создать шаблон».",
          confirmDelete: "Удалить этот шаблон?"
        },
        faq: {
          title: "FAQ",
          description: "Управление часто задаваемыми вопросами для AI-ассистента.",
          loadFailed: "Не удалось загрузить элементы FAQ",
          createFailed: "Не удалось создать FAQ.",
          updateFailed: "Не удалось обновить FAQ.",
          deleteFailed: "Удаление не удалось",
          invalidPayload:
            "Введенные данные некорректны. Проверьте вопрос, ответ, категорию и порядок.",
          refresh: "Обновление...",
          hideForm: "Скрыть форму",
          createFaq: "Создать FAQ",
          newTitle: "Новый элемент FAQ",
          fields: {
            question: "Вопрос",
            answer: "Ответ",
            category: "Категория",
            order: "Порядок",
            active: "Активен"
          },
          create: "Создать",
          creating: "Создание...",
          cancel: "Отмена",
          editTitle: "Редактировать FAQ",
          editDescription: "Быстро редактируйте содержимое, не покидая страницу.",
          save: "Сохранить",
          saving: "Сохранение...",
          subtitleFallback: "Частые вопросы для ассистента",
          categoryPrefix: "Категория: {{category}}",
          empty: "Элементов FAQ нет.",
          orderBadge: "Порядок: {{order}}",
          activeBadge: "Активен",
          inactiveBadge: "Неактивен",
          updatedAt: "Обновлено: {{date}}",
          actions: "Действия",
          edit: "Редактировать",
          deactivate: "Деактивировать",
          activate: "Активировать",
          deleting: "Удаление...",
          delete: "Удалить",
          confirmDelete: "Удалить этот элемент FAQ?"
        },
        healthPage: {
          title: "Состояние системы",
          description:
            "Контролируйте сервисы, оценку месячного бюджета моделей, распределение нагрузки и риск ответов без документального подтверждения."
        },
        healthPanel: {
          badge: {
            ok: "OK",
            warn: "WARN",
            unavailable: "N/A",
            error: "ERROR",
            loading: "..."
          },
          fallback: {
            notAvailable: "n/a"
          },
          format: {
            milliseconds: "{{value}} ms"
          },
          errors: {
            loadFailed: "Не удалось загрузить мониторинг системы",
            loadGeneric: "Ошибка загрузки"
          },
          hero: {
            title: "Панель мониторинга",
            description:
              "Компактный обзор состояния сервисов, использования AI, затрат по моделям и качества ответов.",
            emptyTelemetry:
              "Точная телеметрия пуста, потому что после включения телеметрии еще не было записано ни одного нового чата. Отправьте новое сообщение в чате после перезапуска приложения, чтобы заполнить точные токены, точные расходы и использование оценщика.",
            missingPricing: "Нет прайсинга для: {{models}}",
            updated: "Обновлено: {{timestamp}}"
          },
          services: {
            openai: "OpenAI",
            redis: "Redis",
            database: "База данных",
            statusOk: "OK",
            statusFail: "СБОЙ",
            latency: "Задержка: {{value}} ms",
            model: "Модель: {{value}}",
            databaseExtra: "Фрагменты: {{chunks}} | Сообщения: {{messages}}"
          },
          usage: {
            title: "Сводка использования",
            summary: "сводка 24ч + 30д",
            cards: {
              tokens24hLabel: "Токены 24ч",
              tokens24hHint: "{{value}} запросов",
              spend30dLabel: "Расходы 30д",
              spend30dHint: "{{value}} токенов всего",
              coverageLabel: "Покрытие",
              coverageHint: "{{exact}} / {{assistant}} сообщений",
              judgedLabel: "Оценено",
              judgedHint: "{{value}} оцененных ответов"
            },
            trend: {
              title: "Динамика токенов",
              description: "Объем токенов за последние 30 дней",
              series: "Токены"
            },
            windowTable: {
              columns: {
                window: "Окно",
                tokens: "Токены",
                avgRisk: "Средний риск",
                judged: "Оценено",
                needsReview: "Требует проверки"
              }
            },
            modelBreakdown: "Разбивка по моделям",
            modelTable: {
              columns: {
                model: "Модель",
                operation: "Операция",
                tokens: "Токены",
                spend: "Расходы",
                latency: "Задержка"
              },
              pricingGap: "нет прайсинга",
              noData: "Использование моделей пока отсутствует."
            }
          },
          quality: {
            title: "Сводка качества",
            summary: "фокус 30д",
            cards: {
              averageRiskLabel: "Средний риск",
              averageRiskHint: "p95 {{value}}",
              judgedCoverageLabel: "Покрытие оценки",
              judgedCoverageHint: "{{value}} оцененных ответов",
              needsReviewLabel: "Требует проверки",
              needsReviewHint: "ответы со score >= 0.85",
              latestHighScoreLabel: "Последний высокий риск",
              latestHighScoreHint: "один ответ; график показывает дневные агрегаты",
              noLatestHighScoreHint: "нет недавних ответов, требующих проверки"
            },
            trend: {
              title: "Динамика риска поддержки",
              description: "Средний и p95 показатель риска поддержки по дням",
              averageSeries: "Среднее",
              p95Series: "P95"
            },
            interpretation: {
              title: "Интерпретация и частые причины",
              line1: "Это показатель риска поддержки, а не оценка истинности.",
              line2: "Более высокие значения означают, что ответ сильнее опирается на слабую или отсутствующую поддержку в найденном контексте.",
              line3:
                "Значение вроде 0.8 все еще может быть лишь строгим предупреждением о слабой опоре на контекст, а не обязательно реальной галлюцинацией.",
              noReasons: "Причин оценки пока нет."
            },
            riskyTable: {
              columns: {
                date: "Дата",
                model: "Модель",
                score: "Оценка",
                reason: "Причина",
                feedback: "Отзыв",
                excerpt: "Фрагмент"
              },
              empty: "За последние 30 дней не найдено ответов, требующих проверки."
            }
          }
        }
      }
    }
  },
  en: {
    translation: {
      common: {
        brand: "CIVIS",
        languageSwitcher: {
          ariaLabel: "Change language"
        },
        accessibility: {
          closeDialog: "Close dialog"
        },
        actions: {
          login: "Log in",
          logout: "Log out",
          loggingOut: "Logging out...",
          admin: "Admin",
          backToChat: "Back to chat",
          startConversation: "Ask the assistant",
          accessAdmin: "Access Admin"
        },
        states: {
          loading: "Loading..."
        }
      },
      home: {
        eyebrow: "Public information, clearly explained",
        title: "City Hall Digital Assistant",
        description:
          "CIVIS finds relevant information in City Hall's public documents and answers in Romanian or Russian, citing the document and exact supporting passage.",
        chatCard: {
          title: "Ask CIVIS",
          description:
            "Understand municipal decisions, regulations, and procedures. If information is missing or sources conflict, the assistant will say so clearly."
        },
        adminCard: {
          title: "Admin Panel",
          description:
            "Manage the public-document corpus, templates, feedback, answer quality, and AI model costs."
        }
      },
      auth: {
        adminPanelTitle: "Administration panel",
        fields: {
          email: "Email",
          password: "Password"
        },
        placeholders: {
          email: "admin@civis.local",
          password: "••••••••"
        },
        validation: {
          emailRequired: "Enter your email address",
          passwordRequired: "Enter your password",
          passwordMin: "Password must be at least 8 characters"
        },
        errors: {
          credentials: "Incorrect email or password"
        },
        accessibility: {
          showPassword: "Show password",
          hidePassword: "Hide password",
          emailIcon: "Email icon",
          passwordIcon: "Password icon"
        }
      },
      chat: {
        status: {
          noMessages: "No messages.",
          streamError: "Failed to load the response."
        },
        welcome: {
          title: "Welcome to CIVIS",
          subtitle: "What would you like to know about municipal services?",
          faqLabel: "Frequently asked questions"
        },
        greeting: {
          intro:
            "Hello! 👋 I am CIVIS, City Hall's digital assistant. I search the available public documents and cite the exact source. If information is missing or documents conflict, I will flag it.",
          question: "How can I help you?"
        },
        promptUpgrade: {
          title: "Upgrade your prompt",
          badge: "Smart",
          enable: "Enable suggestions while typing",
          disable: "Disable suggestions while typing",
          emptyInput: "Write your question first."
        },
        composer: {
          placeholder: "Ask about a municipal decision, procedure, or service...",
          send: "Send message",
          sending: "Sending message"
        },
        jumpToLatest: {
          ariaLabel: "Scroll to latest messages",
          title: "New messages"
        },
        message: {
          assistantTyping: "Assistant is typing",
          details: "View sources",
          noSources: "The required information was not found in the available corpus.",
          loadingSources: "Loading sources...",
          loadSourcesFailed: "Failed to load sources",
          source: "Cited document",
          unknown: "unknown",
          similarity: "Similarity"
        },
        feedback: {
          intro:
            "How was your experience? Rate the conversation and help us improve the assistant.",
          helpful: "Helpful",
          notHelpful: "Not helpful",
          saving: "Saving...",
          commentPlaceholder: "Add a comment...",
          submitComment: "Send comment",
          submitFailed: "Failed to submit feedback"
        },
        session: {
          new: "New session",
          modeScreenReader: "Session mode: regular. Expires at: {{expiresLabel}}",
          unknownExpiry: "unknown",
          hintNeedsAnswer: "Send a message and wait for the answer to start a new chat",
          hintNewSession: "End the session and start a new chat",
          terminateFailed: "Failed to terminate the session"
        },
        faq: {
          loadFailed: "Failed to load FAQ items",
          empty: "No active FAQ items."
        },
        prompts: {
          loadFailed: "Failed to load prompt templates",
          empty: "No active templates."
        }
      },
      admin: {
        nav: {
          backToChat: "Back to chat",
          knowledge: "Knowledge Base",
          feedback: "Feedback",
          prompts: "Prompt Templates",
          faq: "FAQ",
          health: "System Health"
        },
        knowledge: {
          title: "Knowledge Base",
          description: "The controlled corpus of City Hall decisions, regulations, and public procedures.",
          uploadButton: "Upload file",
          searchPlaceholder: "Search",
          searchAriaLabel: "Search files",
          loadFailed: "Failed to load the file list",
          deleteFailed: "Delete failed",
          downloadFailed: "Download failed",
          reindexFailed: "Re-index failed"
        },
        fileUpload: {
          title: "Upload document",
          description:
            "Formats: PDF, DOCX, TXT, MD, PNG, JPG, WEBP. Maximum size: {{size}} MB.",
          unsupported: "Only PDF, DOCX, TXT, and MD files are supported.",
          fileTooLarge: "The file exceeds the {{size}} MB limit.",
          uploadFailed: "Upload failed",
          uploaded: "File {{name}} was uploaded.",
          buttonUploading: "Uploading...",
          footer: "After upload, the document will automatically enter the indexing pipeline."
        },
        fileTable: {
          title: "Uploaded files",
          countOne: "1 file in the knowledge base",
          countOther: "{{count}} files in the knowledge base",
          refreshing: "Refreshing...",
          sortBy: "Sort by:",
          newest: "Newest",
          oldest: "Oldest",
          columns: {
            name: "Name",
            size: "File size",
            uploadedAt: "Upload date",
            status: "Status",
            chunks: "Chunks",
            actions: "Actions"
          },
          status: {
            pending: "Pending",
            processing: "Processing",
            ready: "Ready",
            error: "Error"
          },
          openActions: "Open actions",
          actions: {
            reindex: "Re-index",
            save: "Save",
            delete: "Delete"
          },
          confirmDelete: "Delete {{name}} and all indexed chunks?",
          emptyTitle: "No files match the selected filters.",
          emptyDescription:
            "Upload a new document or change the search/sort settings to see results.",
          pagination: {
            label: "File navigation",
            previous: "Previous",
            next: "Next",
            page: "Page {{page}} / {{totalPages}}"
          }
        },
        feedback: {
          title: "Feedback",
          description: "User reviews about how the AI assistant performs",
          refresh: "Refresh",
          exportCsv: "Export CSV",
          loadFailed: "Failed to load feedback analytics",
          negativeTitle: "Negative feedback",
          negativeDescription: "Messages that received negative ratings in recent conversations.",
          columns: {
            date: "Date",
            user: "User",
            comment: "Comment",
            message: "Message",
            session: "Session"
          },
          emptyTitle: "No negative feedback",
          emptyDescription: "Users have only provided positive feedback so far.",
          pagination: {
            showing: "Showing {{from}}-{{to}} of {{total}}",
            previous: "Previous",
            next: "Next",
            page: "Page {{page}} / {{totalPages}}"
          }
        },
        feedbackChart: {
          empty: "There is no chart data yet.",
          cards: {
            totalReviews: "Total reviews",
            positive: "Positive",
            negative: "Negative",
            comments: "Comments"
          },
          lines: {
            positivePercent: "Positive %",
            negativePercent: "Negative %",
            positive: "Positive",
            negative: "Negative"
          },
          statsTitle: "Statistics",
          statsDescription: "% of reviews per day",
          histogramTitle: "Histogram",
          histogramDescription: "Number of reviews per day"
        },
        prompts: {
          title: "Prompt Templates",
          description: "Manage prompt templates for the AI assistant.",
          loadFailed: "Failed to load prompt templates",
          createFailed: "Failed to create the template.",
          updateFailed: "Failed to update the template.",
          deleteFailed: "Delete failed",
          invalidPayload:
            "The provided data is invalid. Check the title, content, category, and order.",
          refresh: "Refreshing...",
          hideForm: "Hide form",
          createTemplate: "Create template",
          newTitle: "New template",
          fields: {
            title: "Title",
            category: "Category",
            content: "Content",
            order: "Order",
            active: "Active"
          },
          create: "Create",
          cancel: "Cancel",
          editTitle: "Edit template",
          editDescription: "Quickly edit the template directly on the page.",
          save: "Save",
          saving: "Saving...",
          saveChanges: "Save changes",
          subtitleFallback: "Reusable template for the AI assistant",
          categoryPrefix: "Category: {{category}}",
          actions: {
            edit: "Edit",
            deactivate: "Deactivate",
            activate: "Activate",
            delete: "Delete"
          },
          general: "General",
          emptyTitle: "No templates are defined.",
          emptyDescription: "Create the first template using the “Create template” button.",
          confirmDelete: "Delete this template?"
        },
        faq: {
          title: "FAQ",
          description: "Manage frequently asked questions for the AI assistant.",
          loadFailed: "Failed to load FAQ items",
          createFailed: "Failed to create the FAQ item.",
          updateFailed: "Failed to update the FAQ item.",
          deleteFailed: "Delete failed",
          invalidPayload:
            "The provided data is invalid. Check the question, answer, category, and order.",
          refresh: "Refreshing...",
          hideForm: "Hide form",
          createFaq: "Create FAQ",
          newTitle: "New FAQ item",
          fields: {
            question: "Question",
            answer: "Answer",
            category: "Category",
            order: "Order",
            active: "Active"
          },
          create: "Create",
          creating: "Creating...",
          cancel: "Cancel",
          editTitle: "Edit FAQ",
          editDescription: "Quickly edit content without leaving the page.",
          save: "Save",
          saving: "Saving...",
          subtitleFallback: "Frequently asked questions for the assistant",
          categoryPrefix: "Category: {{category}}",
          empty: "There are no FAQ items.",
          orderBadge: "Order: {{order}}",
          activeBadge: "Active",
          inactiveBadge: "Inactive",
          updatedAt: "Updated: {{date}}",
          actions: "Actions",
          edit: "Edit",
          deactivate: "Deactivate",
          activate: "Activate",
          deleting: "Deleting...",
          delete: "Delete",
          confirmDelete: "Delete this FAQ item?"
        },
        healthPage: {
          title: "System Health",
          description:
            "Monitor services, the estimated monthly model budget, usage distribution, and the risk of answers without documentary support."
        },
        healthPanel: {
          badge: {
            ok: "OK",
            warn: "WARN",
            unavailable: "N/A",
            error: "ERROR",
            loading: "..."
          },
          fallback: {
            notAvailable: "n/a"
          },
          format: {
            milliseconds: "{{value}} ms"
          },
          errors: {
            loadFailed: "Failed to load system health",
            loadGeneric: "Load error"
          },
          hero: {
            title: "Monitoring dashboard",
            description:
              "One compact view for service status, AI usage, model spend, and answer quality.",
            emptyTelemetry:
              "Exact telemetry is empty because no new chat has been recorded after telemetry was enabled. Send a new message in chat after restarting the app to populate exact tokens, exact spend, and judge usage.",
            missingPricing: "Missing pricing for: {{models}}",
            updated: "Updated: {{timestamp}}"
          },
          services: {
            openai: "OpenAI",
            redis: "Redis",
            database: "Database",
            statusOk: "OK",
            statusFail: "FAIL",
            latency: "Latency: {{value}} ms",
            model: "Model: {{value}}",
            databaseExtra: "Chunks: {{chunks}} | Messages: {{messages}}"
          },
          usage: {
            title: "Usage snapshot",
            summary: "24h + 30d summary",
            cards: {
              tokens24hLabel: "Tokens 24h",
              tokens24hHint: "{{value}} requests",
              spend30dLabel: "Spend 30d",
              spend30dHint: "{{value}} total tokens",
              coverageLabel: "Coverage",
              coverageHint: "{{exact}} / {{assistant}} messages",
              judgedLabel: "Judged",
              judgedHint: "{{value}} judged answers"
            },
            trend: {
              title: "Token trend",
              description: "Token volume over the last 30 days",
              series: "Tokens"
            },
            windowTable: {
              columns: {
                window: "Window",
                tokens: "Tokens",
                avgRisk: "Avg risk",
                judged: "Judged",
                needsReview: "Needs review"
              }
            },
            modelBreakdown: "Model breakdown",
            modelTable: {
              columns: {
                model: "Model",
                operation: "Operation",
                tokens: "Tokens",
                spend: "Spend",
                latency: "Latency"
              },
              pricingGap: "pricing gap",
              noData: "No model usage yet."
            }
          },
          quality: {
            title: "Quality snapshot",
            summary: "30d focus",
            cards: {
              averageRiskLabel: "Average risk",
              averageRiskHint: "p95 {{value}}",
              judgedCoverageLabel: "Judged coverage",
              judgedCoverageHint: "{{value}} judged answers",
              needsReviewLabel: "Needs review",
              needsReviewHint: "answers with score >= 0.85",
              latestHighScoreLabel: "Latest high score",
              latestHighScoreHint: "single answer; chart shows daily aggregates",
              noLatestHighScoreHint: "no recent review-worthy answer"
            },
            trend: {
              title: "Support-risk trend",
              description: "Average and p95 support-risk score by day",
              averageSeries: "Average",
              p95Series: "P95"
            },
            interpretation: {
              title: "Interpretation and common reasons",
              line1: "This is a support-risk score, not a truth score.",
              line2: "Higher values mean the answer relies more on weak or missing support in retrieved context.",
              line3: "A score like 0.8 can still be a strict grounding warning, not necessarily a true hallucination.",
              noReasons: "No judge reasons yet."
            },
            riskyTable: {
              columns: {
                date: "Date",
                model: "Model",
                score: "Score",
                reason: "Reason",
                feedback: "Feedback",
                excerpt: "Excerpt"
              },
              empty: "No review-worthy answers found in the last 30 days."
            }
          }
        }
      }
    }
  }
} as const satisfies Resource;
