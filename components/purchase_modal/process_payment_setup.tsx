// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Stripe} from '@stripe/stripe-js';

import {BillingDetails} from 'types/sku';

import successSvg from 'images/cloud/payment_success.svg';
import failedSvg from 'images/cloud/payment_fail.svg';
import {t} from 'utils/i18n';

import processSvg from 'images/cloud/processing_payment.svg';

import './process_payment.css';

import IconMessage from './icon_message';

type Props = {
    billingDetails: BillingDetails | null;
    stripe: Promise<Stripe>;
    addPaymentMethod: Function;
    onBack: () => void;
    onClose: () => void;
}

type State = {
    progress: number;
    error: string;
    state: ProcessState;
}

enum ProcessState {
    PROCESSING = 0,
    SUCCESS,
    FAILED
}

const MIN_PROCESSING_MILLISECONDS = 5000;
const MAX_FAKE_PROGRESS = 95;

export default class ProcessPaymentSetup extends React.PureComponent<Props, State> {
    intervalId: NodeJS.Timeout;

    public constructor(props: Props) {
        super(props);

        this.intervalId = {} as NodeJS.Timeout;

        this.state = {
            progress: 0,
            error: '',
            state: ProcessState.PROCESSING,
        };
    }

    public componentDidMount() {
        this.savePaymentMethod();

        this.intervalId = setInterval(this.updateProgress, MIN_PROCESSING_MILLISECONDS / MAX_FAKE_PROGRESS);
    }

    public componentWillUnmount() {
        clearInterval(this.intervalId);
    }

    private updateProgress = () => {
        let {progress} = this.state;

        if (progress >= MAX_FAKE_PROGRESS) {
            clearInterval(this.intervalId);
            return;
        }

        progress += 1;
        this.setState({progress: progress > MAX_FAKE_PROGRESS ? MAX_FAKE_PROGRESS : progress});
    }

    private savePaymentMethod = async () => {
        const start = new Date();
        const {stripe, addPaymentMethod, billingDetails} = this.props;

        const errorText = await addPaymentMethod(stripe, billingDetails);

        if (errorText) {
            this.setState({
                error: errorText,
                state: ProcessState.FAILED});
            return;
        }

        const end = new Date();
        const millisecondsElapsed = end.valueOf() - start.valueOf();
        if (millisecondsElapsed < MIN_PROCESSING_MILLISECONDS) {
            setTimeout(this.completePayment, MIN_PROCESSING_MILLISECONDS - millisecondsElapsed);
            return;
        }

        this.completePayment();
    }

    private completePayment = () => {
        clearInterval(this.intervalId);
        this.setState({state: ProcessState.SUCCESS, progress: 100});
    }

    private handleGoBack = () => {
        clearInterval(this.intervalId);
        this.setState({
            progress: 0,
            error: '',
            state: ProcessState.PROCESSING,
        });
        this.props.onBack();
    }

    public render() {
        const {state, progress, error} = this.state;

        const progressBar: JSX.Element | null = (
            <div className='ProcessPayment-progress'>
                <div
                    className='ProcessPayment-progress-fill'
                    style={{width: `${progress}%`}}
                />
            </div>
        );
        switch (state) {
        case ProcessState.PROCESSING:
            return (
                <IconMessage
                    title={t('admin.billing.subscription.verifyPaymentInformation')}
                    subtitle={''}
                    icon={processSvg}
                    footer={progressBar}
                />
            );
        case ProcessState.SUCCESS:
            return (
                <IconMessage
                    title={t('admin.billing.subscription.upgradedSuccess')}
                    subtitle={
                        'Starting August 8, 2020 you will be charged based on the number of enabled users'
                    }
                    error={false}
                    icon={successSvg}
                    buttonText={t('admin.billing.subscription.letsGo')}
                    buttonHandler={this.props.onClose}
                />
            );
        case ProcessState.FAILED:
            return (
                <IconMessage
                    title={t('admin.billing.subscription.paymentVerificationFailed')}
                    subtitle={t('admin.billing.subscription.paymentFailed')}
                    icon={failedSvg}
                    error={true}
                    buttonText={t('admin.billing.subscription.goBackTryAgain')} //formatMessage({id: 'process_payment.try_again'})}
                    buttonHandler={this.handleGoBack}
                    linkText={t('admin.billing.subscription.privateCloudCard.contactSupport')}
                    linkURL='https://support.mattermost.com/hc/en-us/requests/new?ticket_form_id=360000640492'
                />
            );
        default:
            return null;
        }
    }
}
