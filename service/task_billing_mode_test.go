package service

import (
	"testing"

	"github.com/QuantumNous/new-api/setting/config"
	"github.com/stretchr/testify/require"
)

func TestIsPerRequestTaskBillingSkipsSecondsRatio(t *testing.T) {
	saved := map[string]string{}
	require.NoError(t, config.GlobalConfig.SaveToDB(func(key, value string) error {
		saved[key] = value
		return nil
	}))
	t.Cleanup(func() {
		require.NoError(t, config.GlobalConfig.LoadFromDB(saved))
	})

	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"billing_setting.billing_mode": `{"seedance-2.0-mini":"per_request"}`,
	}))

	require.True(t, IsPerRequestTaskBilling("seedance-2.0-mini"))
	require.False(t, ShouldApplyTaskOtherRatio("seedance-2.0-mini", "seconds"))
	require.True(t, ShouldApplyTaskOtherRatio("seedance-2.0-mini", "size"))
}

func TestShouldTaskPerCallBillingFollowsBillingMode(t *testing.T) {
	saved := map[string]string{}
	require.NoError(t, config.GlobalConfig.SaveToDB(func(key, value string) error {
		saved[key] = value
		return nil
	}))
	t.Cleanup(func() {
		require.NoError(t, config.GlobalConfig.LoadFromDB(saved))
	})

	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"billing_setting.billing_mode": `{"request-model":"per_request","second-model":"per_second"}`,
	}))

	require.True(t, ShouldTaskPerCallBilling("request-model", true, map[string]float64{"seconds": 6}))
	require.False(t, ShouldTaskPerCallBilling("second-model", true, map[string]float64{"seconds": 6}))
}
