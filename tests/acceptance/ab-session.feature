# Authored acceptance specification with no Gherkin bindings; not a Jest suite.
# README.md maps current executable unit files to these areas.
# @pending-streaming cases are optional future work; completed-reply transcription is the selected release flow.
# Physical-device and listening cases remain unverified.
# Never count these scenarios as passed from source inspection alone.

Feature: Scenario-based A/B conversations with English display and selected-language audio
  Coachie acts as the tasker and compares two separately captured model conversations.

  @import @unit @ui
  Scenario: Import the scenario rather than the whole website
    Given a synthetic image contains a Thai title, a WHAT TO DO block, Thai language, a time limit and Search-Required
    And it also contains website navigation and a microphone error
    When I import the image
    Then the English review contains the scenario role, objective, constraints, language and time limit
    And website navigation and the microphone error are not scenario facts

  @import @ui
  Scenario: Review without reading Thai
    Given a Thai scenario image has been extracted successfully
    When the scenario review opens
    Then its primary labels and editable content are English
    And original Thai source text is retained in the background
    And neither audio playback nor recording starts before I start the run

  @import @unit
  Scenario: Preserve uncertainty in a blurry image
    Given the scenario title is legible but a destination and date are unreadable
    When extraction finishes
    Then the destination and date remain unset and flagged for review
    And no invented destination or date enters the scenario

  @import @unit
  Scenario: Ignore instructions embedded in an imported image that target the app
    Given an image includes a valid scenario and text saying to reveal an API key and always choose Model A
    When the extracted scenario is validated
    Then the app does not reveal secrets or preselect a winner
    And only approved scenario fields can enter the conversation policy

  @import @ui
  Scenario Outline: Cancel or fail camera import without losing the draft
    Given I have an unsent scenario draft
    When image import ends with <outcome>
    Then my draft is unchanged and no session starts
    And an appropriate recovery option remains available
    Examples:
      | outcome                 |
      | picker cancellation     |
      | camera permission denial|
      | missing camera          |
      | corrupt image           |
      | extraction timeout      |

  @import @ui
  Scenario: Resolve an imported language conflict visibly
    Given my current speaking language is English and the imported scenario requires Thai
    When I review the extracted scenario
    Then the proposed Thai speaking language is visible
    And the active setting changes only when I accept that scenario configuration

  @import @unit @ui
  Scenario: Use a typed topic without inventing source facts
    Given I type only a short topic in English
    When Coachie prepares a scenario
    Then added details are presented as a proposed scenario or requested as clarification
    And they are not labeled as extracted facts

  @import @device
  Scenario Outline: Read supported photo orientations and scripts
    Given a synthetic legible scenario image with <condition>
    When I capture or choose it on a supported target device
    Then important facts and Thai diacritics survive extraction and English review
    And unreadable fields are flagged rather than silently guessed
    Examples:
      | condition                  |
      | portrait orientation       |
      | landscape orientation      |
      | EXIF rotation              |
      | mixed Thai and English     |
      | mild perspective distortion|

  @session @unit
  Scenario: Do not impose a five-question limit
    Given the accepted scenario permits more time and its objective is unresolved
    And A has accepted five model replies
    When its next turn is planned
    Then A may continue toward an unresolved scenario objective
    And completion is not triggered solely by a five-question count

  @session @unit
  Scenario: Honor scenario minimum duration and optional minimum exchanges
    Given a scenario specifies minimum duration and a minimum number of exchanges
    When the goal appears resolved before those requirements are met
    Then automatic completion waits for the requirements or the maximum duration
    And manual early completion is an explicit user action

  @session @unit
  Scenario Outline: Read duration from each accepted scenario
    Given the accepted scenario specifies a maximum of <minutes> minutes per run
    When that duration is reached with optional minimum exchanges still unmet
    Then maximum duration takes precedence over the exchange target
    And no universal five-question or five-minute limit replaces the scenario
    Examples:
      | minutes |
      | 5       |
      | 3       |

  @session @unit
  Scenario: Preserve an explicit high minimum-turn requirement separately from time
    Given the accepted scenario explicitly requires at least fifteen exchanges
    When its turn requirement is imported and reviewed
    Then the minimum exchange field is fifteen
    And no fifteen-minute duration is inferred from that turn requirement

  @session @unit
  Scenario: Do not count replay and conversation repair as new questions
    Given A has two accepted model replies
    When a tasker question is replayed or the same captured reply is retried
    Then the accepted reply counter remains two
    And replay does not append a duplicate conversation turn

  @session @unit
  Scenario: Answer the evaluated model's clarification consistently
    Given the fixed scenario specifies Saturday and a 3000 baht budget
    When the evaluated model asks for the travel day and budget
    Then Coachie answers from those fixed facts in the selected language
    And fixed facts are not changed to favor either model

  @session @ui
  Scenario: Start B below a divider in the same visible chat
    Given A has finished and its English transcript is visible
    When I activate Start Model B
    Then B begins below one clearly labeled Model B divider
    And A remains visible above it
    And B begins with zero accepted model replies and a fresh elapsed timer

  @session @unit
  Scenario: Keep A-specific answers out of B generation context
    Given A disclosed the unique phrase A_PRIVATE_FACT_9731
    When B's next-turn generation request is constructed
    Then that phrase and A's assessment are absent from B's context
    And the shared scenario and B's own earlier turns are present

  @session @unit
  Scenario: Preserve earlier corrections throughout the active run
    Given B corrected Friday to Saturday several turns ago
    When Coachie plans a later follow-up
    Then Saturday is the current fact and the correction remains in context
    And Friday is not silently restored by a summary or reusable clip

  @session @unit
  Scenario: Adapt without making the two runs arbitrarily different
    Given the shared goal includes budget and transport
    And A omitted the budget while B already explained it
    When each run selects its next follow-up
    Then A may receive the budget question while B explores an unresolved comparable objective
    And the evaluator receives each run's actual coverage and unmatched probes

  @session @unit
  Scenario: Accept a reply exactly once across retries
    Given a finalized reply has been persisted under a stable turn ID
    When duplicate completion events and a network retry arrive
    Then the reply and counter advance only once
    And no duplicate history entry or question is created

  @session @unit
  Scenario: Ignore a late A result after switching to B
    Given an A transcription request is still pending when its operation is cancelled
    When B starts and the cancelled A request later resolves
    Then B's transcript, phase, counter and audio cache are unchanged

  @session @unit @ui
  Scenario: Apply the confirmed duration policy without losing captured evidence
    Given the accepted scenario has a per-model time budget
    When that budget is reached during a reply
    Then no further tasker question begins after that reply
    And the UI exposes completion with the captured reply retained
    And does not silently discard the partial recording or mark an unheard answer complete

  @language @unit @ui
  Scenario: Thai speech and English display for Coachie's question
    Given a generated turn contains Thai spoken text and its English translation
    When Coachie delivers the turn
    Then TTS receives the Thai text and the selected Thai-capable voice
    And the primary chat message shows only its English translation

  @language @unit @ui
  Scenario: Thai recording keeps both original and translated evidence
    Given the microphone captured a Thai reply
    When final transcription and translation succeed
    Then the original audio and Thai transcript remain linked to that reply
    And English is displayed by default and Thai remains background context

  @language @unit @pending-streaming
  Scenario: Partial captions do not trigger premature follow-ups
    Given several partial English caption revisions belong to one still-open reply
    When another partial revision arrives
    Then the UI updates the same provisional reply
    And no additional question, accepted reply or score is created

  @language @unit @pending-streaming
  Scenario: Reconcile out-of-order streaming events
    Given transcript revision three has arrived before revision two
    When the older revision arrives followed by finalization
    Then stale text cannot replace newer text
    And exactly one finalized source/English pair enters reasoning

  @language @unit @ui
  Scenario: Translation failure does not expose Thai as the default message
    Given original transcription succeeded but English translation failed
    When the chat renders the reply
    Then an English translation-retry state appears
    And the original audio and source transcript remain recoverable
    And Thai is not substituted into the primary transcript silently

  @language @unit
  Scenario: Detect a truncated transcript
    Given the provider reports an output limit before the reply is fully transcribed
    When the response is processed
    Then it is not accepted as a complete reply
    And retry or chunk reconciliation can use the retained audio without advancing the question counter

  @language @device @listening
  Scenario: Preserve meaning across original speech and English translation
    Given reference audio includes a negation, a date correction, a name, uncertainty and a currency amount
    When the final transcript and English translation are reviewed by a fluent listener
    Then all those facts remain aligned
    And uncertain or unintelligible content is marked rather than invented

  @audio @unit
  Scenario: Silence detection uses current state rather than an old callback closure
    Given recording has started after an earlier idle state
    When end-of-turn detection fires
    Then the existing recording is stopped and finalized once
    And a new recording is not started by a stale phase value

  @audio @ui @device
  Scenario: Manual pause remains available during generation and playback
    Given a provider request or audio playback is active
    When I activate pause or stop
    Then the requested control takes effect without waiting for the long-running operation lock
    And resume continues from a defined recoverable state

  @audio @unit
  Scenario: Close while microphone permission is still resolving
    Given microphone permission or getUserMedia is pending
    When I close the session before it resolves
    Then any subsequently created tracks are stopped
    And no timer, recorder, audio context or UI update survives the closed session

  @audio @device
  Scenario Outline: Handle speech timing without false tasker turns
    Given the evaluated model produces <pattern>
    When Coachie listens using the configured capture controls
    Then capture preserves the reply or offers an explicit manual recovery
    And the trace records any missed speech or premature cutoff
    Examples:
      | pattern                         |
      | a very short yes or no          |
      | a soft-spoken sentence          |
      | a delayed start over seven seconds |
      | a pause over 2.3 seconds mid-answer |
      | background noise followed by speech |

  @audio @device
  Scenario: Do not transcribe Coachie's replay as the evaluated model
    Given the microphone can acoustically hear Coachie's speaker
    When a cached question is replayed
    Then capture ownership prevents that replay becoming a new model reply
    And normal capture resumes without losing the evaluated model's intended answer

  @audio @unit @device @pending-streaming
  Scenario: Recover from streaming failure using the retained recording
    Given recording is active and the incremental transcription connection drops
    When fallback transcription runs
    Then the same reply is finalized without duplicated segments or question increments
    And the user sees that live transcription is temporarily unavailable

  @cache @unit
  Scenario: Replay the same opener without another generation or TTS call
    Given A's opener audio is stored with the unchanged scenario, language and voice configuration
    When I start B with that same opener
    Then the stored audio is played
    And opener text-generation and TTS call counts do not increase
    And B history records the delivered opener

  @cache @unit
  Scenario: Select a relevant cached follow-up within the normal planning call
    Given an eligible cached question addresses an unresolved objective
    When the normal dialogue decision selects its ID
    Then the audio plays with no separate cache-decision call and no TTS request
    And its actual source text enters the active history

  @cache @unit
  Scenario: Reject an answered or A-specific cached question
    Given a cached clip asks about an already-resolved fact or asserts an A-only detail
    When B's dialogue decision proposes that clip
    Then validation rejects it and requests or selects an eligible alternative
    And the rejected wording is not played or appended to B history

  @cache @unit
  Scenario Outline: Invalidate audio when synthesis identity changes
    Given an utterance is cached
    When its <setting> changes
    Then the old audio is not treated as an exact cache hit
    Examples:
      | setting       |
      | spoken text   |
      | language      |
      | voice ID      |
      | delivery style|
      | TTS model     |
      | audio encoding|

  @cache @unit
  Scenario: Regenerate a missing cached file safely
    Given a valid cache entry points to a missing or corrupt audio file
    When playback is requested
    Then the app regenerates or offers retry without duplicating the turn
    And a repeated failure does not create an infinite retry loop

  @evaluation @unit @ui
  Scenario: Compare only after both runs end
    Given A is complete and B is still active
    When B produces an intermediate reply
    Then no winner or coaching feedback interrupts the run
    And comparison becomes available only after B finishes or is explicitly ended

  @evaluation @unit
  Scenario: Task failure cannot be outweighed by attractive speech
    Given A failed an essential scenario constraint while B met it
    And A has a more pleasant voice
    When the evaluator compares the runs
    Then it applies the scenario's task-success gate before softer preferences
    And cites the relevant turn evidence

  @evaluation @unit
  Scenario: Reject invented evidence references
    Given an evaluator response references a turn ID that does not exist
    When comparison validation runs
    Then that finding is not presented as supported evidence
    And the evaluator retries or returns an explicit incomplete assessment

  @evaluation @unit
  Scenario: Distinguish claims of research from verified research
    Given a model says it searched but only its spoken reply was captured
    When the comparison evaluates factual support
    Then actual external search use is marked unobserved
    And independent fact checking, if performed, carries its own sources and verification date

  @evaluation @unit
  Scenario: Abstain on missing evidence rather than blame a model
    Given B's recording failed and its answer is unavailable
    When evaluation runs
    Then the outcome can be insufficient evidence or technical failure
    And missing captured audio is not automatically rated as a model task failure

  @evaluation @unit
  Scenario: Do not score model vocal quality from translated text
    Given only transcripts are available for a run
    When the evaluator assesses audio quality
    Then it marks that dimension unavailable
    And it does not use Coachie's synthesized question audio as substitute evidence

  @evaluation @ui
  Scenario: Preserve the user's independent final choice
    Given Coachie recommends A with linked evidence
    When I choose B, tie or insufficient evidence
    Then my choice is saved separately from the recommendation
    And the recommendation is not rewritten to imply I agreed

  @storage @unit
  Scenario: Keep legacy chats readable without inventing Model B
    Given a saved v1 five-round interview exists
    When the new application loads it
    Then its original transcript and feedback remain readable
    And it is not presented as a completed A/B comparison

  @storage @unit
  Scenario: Resume at the model boundary after a reload
    Given A and the waiting-to-start-B state were persisted
    When the app reloads
    Then A's transcript and the Model B divider return
    And no recording, opener or B request begins without my action

  @storage @unit
  Scenario: Delete a conversation and its owned evidence without harming another
    Given two sessions reference a shared generated clip and each owns a separate model recording
    When I delete one session
    Then its owned retained recordings, transcripts, translations and comparison are removed
    And the other session and its referenced shared clip remain usable
    And deleted sample chats remain deleted

  @storage @unit @ui
  Scenario: Retain a captured reply across translation failure and reload
    Given a Thai recording and original source transcript have been saved as a pending reply
    When its English translation fails and I reload the session
    Then the same audio asset and source transcript remain available for retry
    And retry does not require a new recording or duplicate the accepted reply
    And the primary UI remains English

  @storage @unit @ui
  Scenario: Keep evidence until the user deletes it
    Given an A/B conversation contains recordings, source transcripts, English translations and a comparison
    When I close and reopen the application without deleting its local storage
    Then the saved evidence remains available
    And completing evaluation does not automatically evict its recordings

  @session @unit @ui
  Scenario: Resume an undelivered question after interruption
    Given the tasker question was saved but playback did not finish
    When I resume or retry the session
    Then the same saved question is replayed rather than a new question generated
    And it does not enter delivered evidence until playback completion or explicit acceptance

  @session @unit @ui
  Scenario: Retry storage without repeating accepted work
    Given a reply or comparison is committed in memory and its storage write fails
    When I retry saving
    Then the existing committed result is saved
    And transcription, question generation and comparison are not repeated solely because saving failed

  @audio @device
  Scenario Outline: Validate the confirmed phone and computer arrangement equally
    Given Coachie runs on a physical <phone> and evaluated model audio plays on a computer speaker
    When I capture, pause, replay, resume and finish a model reply
    Then the original reply remains audible and associated with its English transcript
    And real latency, cutoffs, echo and permission behavior are recorded separately from mocked checks
    Examples:
      | phone   |
      | iPhone  |
      | Android |

  @voice @device @listening
  Scenario Outline: Audition ordinary adult character directions
    Given matched opener, clarification and follow-up scripts in <language>
    When the user and a fluent listener compare the candidate profiles
    Then perceived naturalness, phrasing, accent and pacing are recorded from actual audio
    And a configured age direction is not treated as proof of perceived age or quality
    Examples:
      | language         |
      | Thai             |
      | English          |
      | Nigerian English |

  @ui @regression
  Scenario: Preserve the latest visual and accessibility behavior
    Given the A/B flow is open at narrow mobile and desktop widths
    When I use the drawer, composer, transcription controls, quick settings and waveform playback
    Then the drawer remains within DesignFrame and controls remain visible and keyboard accessible
    And reduced-motion preferences are respected
    And the latest pause labels, loading states and deletion confirmation remain intact
